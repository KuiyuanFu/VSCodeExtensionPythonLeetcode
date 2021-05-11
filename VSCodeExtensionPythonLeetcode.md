# VSCodeExtensionPythonLeetcode



## 第一个扩展

[Your First Extension | Visual Studio Code Extension API](https://code.visualstudio.com/api/get-started/your-first-extension)



### 安装

````shell
npm install -g yo generator-code typescript  vsce
npm install
````

###  生成代码

````shell
yo code
code ./helloworld
````

## 扩展结构剖析

[Extension Anatomy | Visual Studio Code Extension API](https://code.visualstudio.com/api/get-started/extension-anatomy)

### 关键部分

三个：

- Activation Events：使扩展活跃的事件
- Contribution Points：在 `package.json` 中扩展VSCode的静态声明
- VS Code API：扩展使用的JS APIs



### 文件结构

````shell
.
├── .vscode
│   ├── launch.json     // Config for launching and debugging the extension
│   └── tasks.json      // Config for build task that compiles TypeScript
├── .gitignore          // Ignore build output and node_modules
├── README.md           // Readable description of your extension's functionality
├── src
│   └── extension.ts    // Extension source code
├── package.json        // Extension manifest
├── tsconfig.json       // TypeScript configuration
````



- `launch.json` 注册 [dubug](https://code.visualstudio.com/docs/editor/debugging)
- `tasks.json ` 定义 [Tasks]( https://code.visualstudio.com/docs/editor/tasks)
- `tsconfig.json` 查阅 [TypeScript ](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)

- `package.json` 是VSCode 的清单文件，包括依赖及信息。
  - `name` ， `publisher` 名字 发行商
  - `main` 接入点
  - `activationEvents ` `contributes`[ Activation Events](https://code.visualstudio.com/api/references/activation-events  )  [Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
  - `engines.vscode` 最小 VSCode API 版本



### 接入点

`src\extension.ts` 下的两个函数。

`activate` 激活时调用。 

`deactivate` 退出时调用。



## 发布



https://code.visualstudio.com/api/working-with-extensions/publishing-extension

```shell
# 安装
npm install -g vsce
# 打包
vsce package

# 需要按照链接中教程，创建token，一定要选定All accessible organizations，之后登录
vsce login <publisher name>

# 发布
vsce publish

```

````shell

````

## 





````shell

````



## 





````shell

````



