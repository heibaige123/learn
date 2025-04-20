# git submodule

## 添加子模块

```sh
git submodule add <remote repo url> <local repo url>
```

## 更新子模块

```sh
git submodule update --init --recursive
```

## 删除子模块

1. 删除子模块的目录
2. 删除 `.git/config` 中的子模块配置
3. 删除 `.gitmodules` 中的子模块配置
4. 删除 `.git/modules/<submodule>` 目录
5. 运行 `git rm --cached <子模块路径>`
