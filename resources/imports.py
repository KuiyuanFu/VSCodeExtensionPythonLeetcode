from typing import *
from collections import *
import sys
import os
from itertools import *
from math import *
from heapq import *
from bisect import *
import random

rootPath = os.path.dirname(sys.path[0])
os.chdir(rootPath)


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

    def __str__(self):
        s = [self.val]
        p = self.next
        while p:
            s.append(p.val)
            p = p.next
        return str(s)

    def __repr__(self):
        return self.__str__()


def listToListNode(l: List[int]) -> ListNode:
    ''' List[int] to ListNode '''
    pseudo = ListNode()
    p = pseudo
    for i in l:
        p.next = ListNode(i)
        p = p.next
    return pseudo.next


class TreeNode:
    def __init__(self,
                 val: int = 0,
                 left: 'TreeNode' = None,
                 right: 'TreeNode' = None,
                 next: 'TreeNode' = None):
        self.val = val
        self.left = left
        self.right = right
        self.next = next

    def __str__(self):
        s = [self.val]
        import queue
        q = queue.Queue()
        q.put(self)
        while not q.empty():
            node = q.get()

            if node.left:
                q.put(node.left)
                s.append(node.left.val)
            else:
                s.append(None)
            if node.right:
                q.put(node.right)
                s.append(node.right.val)
            else:
                s.append(None)

        while len(s) > 0 and s[-1] == None:
            s.pop()

        return str(s)

    def __repr__(self):
        return self.__str__()


def listToTreeNode(l: List[int]) -> TreeNode:
    ''' List[int] to TreeNode '''
    if len(l) == 0:
        return None
    head = TreeNode(val=l[0])
    if len(l) == 1:
        return head

    import queue
    q = queue.Queue()
    q.put(head)
    f = None
    flag = True
    for n in range(1, len(l)):

        n = l[n]
        if n != None:
            n = TreeNode(val=n)
            q.put(n)
        if flag:
            f = q.get()
            f.left = n
        else:
            f.right = n
        flag = not flag

    return head
