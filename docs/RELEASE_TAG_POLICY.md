# Release Tag Policy

本项目建议使用**注释标签（annotated tag）**作为正式发布标记。

## 推荐格式

- `vYYYY.MM.DD`
- 如同一天多次发布，可追加序号：`vYYYY.MM.DD-1`

## 打 tag 前置条件

只有在以下条件全部满足后，才允许打正式 tag：

- `backend` build 通过
- `frontend` build 通过
- smoke test 通过
- `shadowrocket` / `clash` / `mihomo` / `sing-box` 测试结论已记录
- `git status` 已检查

## 推荐流程

1. 先确认当前工作区没有遗漏的改动。
2. 先提交 commit，再打 tag。
3. 不要在未提交改动上直接打 tag。

## 推荐命令

```bash
git status
git add .
git commit -m "release: prepare production deployment"
git tag -a vYYYY.MM.DD -m "subscription_manager release YYYY-MM-DD"
git push origin main
git push origin vYYYY.MM.DD
```

## 选择理由

- 日期可读性强，适合当前迭代频繁的发布节奏
- 避免过早承诺严格语义版本号
- 方便与上线窗口、备份快照、任务状态对应

