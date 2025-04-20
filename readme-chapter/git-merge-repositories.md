# 合并两个git仓库

## 1. 下载 git-filter-repo

- [官网](https://github.com/newren/git-filter-repo/)

```sh
brew install git-filter-repo
```

## 2. git clone 主/子项目

```sh
git clone git@github.com:vercel/ms.git
```

## 3. 子项目更改历史文件路径

```sh
git filter-repo --path-rename "":"ms/"
```

## 4. 在主项目下pull本地的子项目

```sh
git remote add ms /Users/huoguang/Documents/code/source-code/demo01/ms
```

## 5. 拉取本地子项目代码

```sh
git pull ms
```

## 6. 合并两个仓库历史

```sh
git merge --allow-unrelated-histories ms/main
```
