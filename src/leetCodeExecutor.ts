// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as cp from "child_process";
import * as fse from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as requireFromString from "require-from-string";
import { ExtensionContext } from "vscode";
import { ConfigurationChangeEvent, Disposable, MessageItem, window, workspace, WorkspaceConfiguration } from "vscode";
import { Endpoint, IProblem, leetcodeHasInited, supportedPlugins } from "./shared";
import { executeCommand, executeCommandWithProgress } from "./utils/cpUtils";
import { DialogOptions, openUrl } from "./utils/uiUtils";
import * as wsl from "./utils/wslUtils";
import { toWslPath, useWsl } from "./utils/wslUtils";
import { explorerNodeManager } from "./explorer/explorerNodeManager";
class LeetCodeExecutor implements Disposable {
    private leetCodeRootPath: string;
    private nodeExecutable: string;
    private configurationChangeListener: Disposable;

    constructor() {
        this.leetCodeRootPath = path.join(__dirname, "..", "..", "node_modules", "vsc-leetcode-cli");
        this.nodeExecutable = this.getNodePath();
        this.configurationChangeListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
            if (event.affectsConfiguration("leetcode.nodePath")) {
                this.nodeExecutable = this.getNodePath();
            }
        }, this);
    }

    public async getLeetCodeBinaryPath(): Promise<string> {
        if (wsl.useWsl()) {
            return `${await wsl.toWslPath(`"${path.join(this.leetCodeRootPath, "bin", "leetcode")}"`)}`;
        }
        return `"${path.join(this.leetCodeRootPath, "bin", "leetcode")}"`;
    }

    public async meetRequirements(context: ExtensionContext): Promise<boolean> {
        const hasInited: boolean | undefined = context.globalState.get(leetcodeHasInited);
        if (!hasInited) {
            await this.removeOldCache();
        }
        if (this.nodeExecutable !== "node") {
            if (!await fse.pathExists(this.nodeExecutable)) {
                throw new Error(`The Node.js executable does not exist on path ${this.nodeExecutable}`);
            }
            // Wrap the executable with "" to avoid space issue in the path.
            this.nodeExecutable = `"${this.nodeExecutable}"`;
            if (useWsl()) {
                this.nodeExecutable = await toWslPath(this.nodeExecutable);
            }
        }
        try {
            await this.executeCommandEx(this.nodeExecutable, ["-v"]);
        } catch (error) {
            const choice: MessageItem | undefined = await window.showErrorMessage(
                "LeetCode extension needs Node.js installed in environment path",
                DialogOptions.open,
            );
            if (choice === DialogOptions.open) {
                openUrl("https://nodejs.org");
            }
            return false;
        }
        for (const plugin of supportedPlugins) {
            try { // Check plugin
                await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "plugin", "-e", plugin]);
            } catch (error) { // Remove old cache that may cause the error download plugin and activate
                await this.removeOldCache();
                await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "plugin", "-i", plugin]);
            }
        }
        // Set the global state HasInited true to skip delete old cache after init
        context.globalState.update(leetcodeHasInited, true);
        return true;
    }

    public async deleteCache(): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "cache", "-d"]);
    }

    public async getUserInfo(): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "user"]);
    }

    public async signOut(): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "user", "-L"]);
    }

    public async listProblems(showLocked: boolean): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, showLocked ?
            [await this.getLeetCodeBinaryPath(), "list"] :
            [await this.getLeetCodeBinaryPath(), "list", "-q", "L"],
        );
    }
    // FuTodo 文件内容函数
    public async showProblem(problemNode: IProblem, language: string, filePath: string, showDescriptionInComment: boolean = false): Promise<void> {
        showDescriptionInComment = true;
        const templateType: string = showDescriptionInComment ? "-cx" : "-c";


        if (!await fse.pathExists(filePath)) {
            await fse.createFile(filePath);
            const codeTemplate: string = await this.executeCommandWithProgressEx("Fetching problem data...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "show", problemNode.id, templateType, "-l", language]);
            // FuTodo diy模板的函数
            const codeTemplateR: string = await this.diyTemplate(problemNode, language, codeTemplate);
            await fse.writeFile(filePath, codeTemplateR);
        }
    }
    // FuTodo 批量更改已存在的文件逻辑
    public async diyExistFiles(language: string, dirPath: string): Promise<void> {
        if (language != 'python3') {
            return
        }
        var fileNames = fse.readdirSync(dirPath)

        for (var fileName of fileNames) {
            var mathResult = fileName.match(/(^\d+)\..*?.py$/)
            if (mathResult == null || mathResult.length != 2) {
                continue
            }
            var idString = mathResult[1]
            var problemNode = await explorerNodeManager.getNodeByIdRefresh(idString)
            if (!problemNode) {
                continue
            }
            var filePath = path.join(dirPath, fileName)
            filePath = wsl.useWsl() ? await wsl.toWinPath(filePath) : filePath;
            var codeTemplate = (await fse.readFile(filePath)).toString()
            const codeTemplateR: string = await this.diyTemplate(problemNode as IProblem, language, codeTemplate);
            await fse.writeFile(filePath, codeTemplateR);

        }
    }

    private async diyTemplate(problemNode: IProblem, language: string, codeTemplate: string): Promise<string> {

        if (language != 'python3' || problemNode == null) {
            return codeTemplate;
        }
        var blocks = this.codeTemplateSplit(codeTemplate)
        var [app, tags, imports, idea, group, rank, code, main,] = blocks

        this.generateTags(tags, problemNode)
        this.generateImports(imports)
        this.generateIdea(idea)
        this.generateGroup(group)
        this.generateRank(rank)
        this.generateCode(code)
        this.generateMain(main, app, code)

        return blocks.map(
            (l) => {
                return l.join("\r\n")
            }
        ).join("\r\n\r\n");
    }
    private generateTags(block: string[], problemNode: IProblem,) {
        if (block.length != 0) {
            return
        }
        block.push('# @lc tags=' + problemNode.tags.join(';'),)
    }
    private generateImports(block: string[],) {
        if (block.length != 0) {
            return
        }
        var t = [
            '# @lc imports=start',
            'from imports import *',
            '# @lc imports=end',
        ]
        t.forEach(
            (s) => {
                block.push(s)
            }
        )
    }
    private generateIdea(block: string[],) {
        if (block.length != 0) {
            return
        }
        var t = [
            '# @lc idea=start',
            '# ',
            '# ',
            '# ',
            '# @lc idea=end',
        ]
        t.forEach(
            (s) => {
                block.push(s)
            }
        )
    }
    private generateGroup(block: string[],) {
        if (block.length != 0) {
            return
        }

        block.push('# @lc group=')
    }
    private generateRank(block: string[],) {
        if (block.length != 0) {
            return
        }
        block.push('# @lc rank=')

    }

    private generateCode(block: string[],) {
        var flag = false

        for (var element of block) {
            if (element.match(/^#/)) {
                continue
            }
            if (flag) {
                if (element.trim() != '') {
                    flag = false
                }
            }
            if (element.match(/def/)) {
                flag = true;
                break
            }
        }
        if (flag == true) {
            var tail = block.pop()
            block.push('        pass')
            block.push(tail as string)
        }
    }
    private generateMain(block: string[], app: string[], code: string[]) {
        if (block.length != 0) {
            return
        }
        block.push('# @lc main=start',)
        block.push("if __name__ == '__main__':",)

        var funcLine: string = ''
        for (var element of code) {
            if (element.match(/^#/)) {
                continue
            }
            if (element.match(/def/)) {
                funcLine = element
                break
            }
        }
        // 获得函数名
        var matchResult = funcLine.match(/def ?(.*?)\(/)
        var funcName = ''
        if (matchResult != null && matchResult.length >= 2) {
            funcName = matchResult[1].trim()
        }
        // 获得参数
        var matchResult = funcLine.match(/\((.*?)\)/)
        var paraString = ''
        if (matchResult != null && matchResult.length >= 2) {
            paraString = matchResult[1].trim()
        }

        var paraItems: string[] = paraString.split(',')
        var paraItemPairs = paraItems.map(element => {
            return element.split(':').map(
                element => {
                    return element.trim()
                }
            )
        }).slice(1);

        // 获得例子的行
        var exampleLines: string[][] = []
        var index = -1
        app.forEach(element => {
            element = element.slice(1).trim()
            if (element.match(/Example [0-9]*:/)) {
                exampleLines.push([])
                index = exampleLines.length - 1
            }
            else if (element.match(/Constraints:/)) {
                index = -1
            }
            else if (index != -1) {
                exampleLines[index].push(element)
            }
        });
        // 获得例子
        var examples: string[][] = []
        exampleLines.forEach(exampleLine => {
            examples.push(["", ""])
            index = -1
            exampleLine.forEach(l => {
                if (l.slice(0, 'Input:'.length) == 'Input:') {
                    index = 0
                    examples[examples.length - 1][index] += l.slice('Input:'.length).trim()
                }
                else if (l.slice(0, 'Output:'.length) == 'Output:') {
                    index = 1
                    examples[examples.length - 1][index] += l.slice('Output:'.length).trim()
                }

                else if (l.slice(0, 'Output:'.length) == 'Output:') {
                    index = 1
                    examples[examples.length - 1][index] += l.slice('Output:'.length).trim()
                }
                else if (l.slice(0, 'Explanation:'.length) == 'Explanation:' || l.slice(0, 'Note:'.length) == 'Note:') {
                    index = -1
                }
                else if (index != -1) {
                    examples[examples.length - 1][index] += l

                }

            });

        });

        // 生成调用
        var regString = ''
        paraItemPairs.forEach(paraItemPair => {
            regString += paraItemPair[0] + ' *=(.*?)'
        });
        regString += '$'
        var reg = RegExp(regString)
        examples.forEach((example, exampleIndex) => {
            var matchResult = example[0].match(reg)

            var para = paraItemPairs.map((paraItemPair, index) => {

                if (matchResult == null) {
                    return 'error'
                }
                var p = matchResult[index + 1].trim()
                if (p[p.length - 1] == ',') {
                    p = p.slice(0, p.length - 1)
                }

                if (paraItemPair[1] == 'ListNode') {
                    return "listToListNode(" + p + ")"
                }
                else if (paraItemPair[1] == 'TreeNode') {
                    p = p.replace('null', 'None')
                    return "listToTreeNode(" + p + ")"
                }
                else {
                    return p
                }


            }).join(',');
            block.push("    print('Example " + (exampleIndex + 1) + ":')",)
            block.push("    print('Input : ')",)
            block.push("    print('" + example[0] + "')",)
            block.push("    print('Output :')",)
            block.push("    print(str(Solution()." + funcName + "(" + para + ")))",)
            block.push("    print('Exception :')",)
            block.push("    print('" + example[1] + "')",)
            block.push("    print()",)
            block.push("    ",)
        });



        block.push('    pass',)
        block.push('# @lc main=end',)
    }
    private codeTemplateSplit(codeTemplate: string,): string[][] {
        var blocks: string[][] = [[], [], [], [], [], [], [], []]
        var strs = codeTemplate.split('\r\n');
        var index = -1;
        strs.forEach(
            (str) => {
                if (str.match(/@lc/)) {
                    if (str.match(/end/)) {
                        blocks[index].push(str);
                        index = -1
                    }
                    else {
                        if (str.match(/app/)) {
                            index = 0
                        }
                        else if (str.match(/tags/)) {
                            index = 1
                        }
                        else if (str.match(/imports/)) {
                            index = 2
                        }
                        else if (str.match(/idea/)) {
                            index = 3
                        }
                        else if (str.match(/group/)) {
                            index = 4
                        }
                        else if (str.match(/rank/)) {
                            index = 5
                        }
                        else if (str.match(/code/)) {
                            index = 6
                        }
                        else if (str.match(/main/)) {
                            index = 7
                        }

                    }
                }
                if (index != -1) {
                    blocks[index].push(str);
                }

            }
        )
        return blocks
    }
    public async showSolution(input: string, language: string): Promise<string> {
        const solution: string = await this.executeCommandWithProgressEx("Fetching top voted solution from discussions...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "show", input, "--solution", "-l", language]);
        return solution;
    }

    // FuTodo 获得描述执行位置
    public async getDescription(problemNodeId: string): Promise<string> {
        return await this.executeCommandWithProgressEx("Fetching problem description...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "show", problemNodeId, "-x"]);
    }

    public async listSessions(): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "session"]);
    }

    public async enableSession(name: string): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "session", "-e", name]);
    }

    public async createSession(id: string): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "session", "-c", id]);
    }

    public async deleteSession(id: string): Promise<string> {
        return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "session", "-d", id]);
    }

    public async submitSolution(filePath: string): Promise<string> {
        try {
            return await this.executeCommandWithProgressEx("Submitting to LeetCode...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "submit", `"${filePath}"`]);
        } catch (error) {
            if (error.result) {
                return error.result;
            }
            throw error;
        }
    }

    public async testSolution(filePath: string, testString?: string): Promise<string> {
        if (testString) {
            return await this.executeCommandWithProgressEx("Submitting to LeetCode...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "test", `"${filePath}"`, "-t", `${testString}`]);
        }
        return await this.executeCommandWithProgressEx("Submitting to LeetCode...", this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "test", `"${filePath}"`]);
    }

    public async switchEndpoint(endpoint: string): Promise<string> {
        switch (endpoint) {
            case Endpoint.LeetCodeCN:
                return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "plugin", "-e", "leetcode.cn"]);
            case Endpoint.LeetCode:
            default:
                return await this.executeCommandEx(this.nodeExecutable, [await this.getLeetCodeBinaryPath(), "plugin", "-d", "leetcode.cn"]);
        }
    }

    public async toggleFavorite(node: IProblem, addToFavorite: boolean): Promise<void> {
        const commandParams: string[] = [await this.getLeetCodeBinaryPath(), "star", node.id];
        if (!addToFavorite) {
            commandParams.push("-d");
        }
        await this.executeCommandWithProgressEx("Updating the favorite list...", "node", commandParams);
    }

    public async getCompaniesAndTags(): Promise<{ companies: { [key: string]: string[] }, tags: { [key: string]: string[] } }> {
        // preprocess the plugin source
        const companiesTagsPath: string = path.join(this.leetCodeRootPath, "lib", "plugins", "company.js");
        const companiesTagsSrc: string = (await fse.readFile(companiesTagsPath, "utf8")).replace(
            "module.exports = plugin",
            "module.exports = { COMPONIES, TAGS }",
        );
        const { COMPONIES, TAGS } = requireFromString(companiesTagsSrc, companiesTagsPath);
        return { companies: COMPONIES, tags: TAGS };
    }

    public get node(): string {
        return this.nodeExecutable;
    }

    public dispose(): void {
        this.configurationChangeListener.dispose();
    }

    private getNodePath(): string {
        const extensionConfig: WorkspaceConfiguration = workspace.getConfiguration("leetcode", null);
        return extensionConfig.get<string>("nodePath", "node" /* default value */);
    }

    private async executeCommandEx(command: string, args: string[], options: cp.SpawnOptions = { shell: true }): Promise<string> {
        if (wsl.useWsl()) {
            return await executeCommand("wsl", [command].concat(args), options);
        }
        return await executeCommand(command, args, options);
    }

    private async executeCommandWithProgressEx(message: string, command: string, args: string[], options: cp.SpawnOptions = { shell: true }): Promise<string> {
        if (wsl.useWsl()) {
            return await executeCommandWithProgress(message, "wsl", [command].concat(args), options);
        }
        return await executeCommandWithProgress(message, command, args, options);
    }

    private async removeOldCache(): Promise<void> {
        const oldPath: string = path.join(os.homedir(), ".lc");
        if (await fse.pathExists(oldPath)) {
            await fse.remove(oldPath);
        }
    }

}

export const leetCodeExecutor: LeetCodeExecutor = new LeetCodeExecutor();
