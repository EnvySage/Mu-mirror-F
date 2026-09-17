# Mu-mirror 前端部署手册

## 一、部署架构

```
本地 push 到 main
      ↓
GitHub Actions 云端构建（Vue3 + Vite 8 / Node 22）
      ↓
打包 dist → 上传到 Release（tag: deploy）
      ↓
服务器每小时整点检查一次（cron）
      ↓
发现新版本 → 下载 → 校验 → 原子切换 → nginx reload
      ↓
失败自动回滚到上一个版本
```

**延迟**：0 ~ 60 分钟（取决于你在整点前后的哪个时间推送）

> 说明：曾尝试过 webhook 实时通知（GitHub 构建完主动通知服务器），
> 但 GitHub 构建机（境外）到阿里云国内节点的链路时通时断，
> 实测成功率不稳定，已移除，改用轮询这种 100% 可靠的方式。

---

## 二、日常发布

```bash
git add .
git commit -m "你的改动"
git push origin main
```

推完就不用管了，整点时服务器会自动拉最新版本。

---

## 三、手动命令速查

### 立即检查并部署（不等整点）

```bash
/usr/local/bin/mirror-fetch.sh
```

- 没有任何输出 = 当前已是最新版，无需操作
- 有输出 = 正在部署或报错

### 强制重新部署当前最新版

（回滚之后想回到最新版时使用）

```bash
rm -f /var/lib/mirror-deploy/last
/usr/local/bin/mirror-fetch.sh
```

### 回滚到上一个版本

```bash
/usr/local/bin/deploy-mirror.sh rollback
```

输出 `已回滚到 20260917-xxxxxx` 即成功。

### 查看当前生效版本

```bash
ls -l /home/mu-mirror/dist
```

输出类似：

```
dist -> /home/mu-mirror/releases/20260917-221812
```

### 查看所有历史版本

```bash
ls -lt /home/mu-mirror/releases
```

按时间倒序，第一行就是当前生效的版本。系统自动保留最近 **5** 个版本。

### 查看部署日志

```bash
tail -20 /var/log/mirror-fetch.log     # 最近的部署记录
tail -f /var/log/mirror-fetch.log      # 实时跟踪（Ctrl+C 退出）
```

### 查看定时任务

```bash
crontab -l | grep mirror
```

当前配置：`0 * * * *` = 每小时整点执行一次。

### 修改检查频率

```bash
crontab -e
```

改这一行的 cron 表达式，例如：

| 表达式 | 含义 |
|---|---|
| `0 * * * *` | 每小时整点（当前，最省） |
| `*/30 * * * *` | 每 30 分钟 |
| `*/10 * * * *` | 每 10 分钟 |
| `*/5 * * * *` | 每 5 分钟 |

> ⚠️ 注意：脚本通过 GitHub API 获取版本信息，**未认证 API 限流 60 次/小时**。
> 若改成每 10 分钟（6 次/小时）或更频繁，建议给脚本配置 GitHub Token，
> 否则可能触发限流报错。每小时一次绝对安全。

---

## 四、目录结构

```
/home/mu-mirror/
├── releases/                    # 所有历史版本
│   ├── 20260917-221812/         # 每次部署生成一份
│   ├── 20260917-221743/
│   └── ...                      # 自动保留最近 5 份
└── dist -> releases/20260917-221812    # 软链，nginx 指向它
```

nginx 配置的 root 是 `/home/mu-mirror/dist`（软链），**切换版本时 nginx 配置不需要改动**。

相关文件：

| 路径 | 作用 |
|---|---|
| `/usr/local/bin/mirror-fetch.sh` | 检查并拉取最新版本 |
| `/usr/local/bin/deploy-mirror.sh` | 发布/回滚（原子切换） |
| `/var/lib/mirror-deploy/last` | 记录已部署的版本号 |
| `/var/log/mirror-fetch.log` | 部署日志 |

---

## 五、部署脚本的安全机制

1. **校验**：解压后必须存在非空的 `index.html`，否则放弃本次发布
2. **原子切换**：用 `ln -s` + `mv -Tf`，用户不会访问到半新半旧的文件
3. **自动回滚**：nginx 配置检查失败时自动切回上一个版本
4. **权限修正**：`chmod -R a+rX`，防止 GitHub 打包的文件权限过严导致 403
5. **保留历史**：自动清理超过 5 个的旧版本，磁盘不会涨

---

## 六、常见问题

**Q：推送了但线上没更新？**

先手动触发一次：

```bash
/usr/local/bin/mirror-fetch.sh
```

再看日志排查：

```bash
tail -20 /var/log/mirror-fetch.log
```

**Q：部署了但页面还是旧的？**

浏览器强制刷新：`Ctrl + F5`（Vite 静态资源有缓存）。

**Q：回滚后会不会又被自动部署回去？**

不会。回滚后版本记录未变，脚本认为已是最新，不会重新拉取。
想回到最新版，用「强制重新部署」那两条命令。

**Q：站点打不开了？**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:10000/
```

返回 200 正常；不是 200 就立刻回滚：

```bash
/usr/local/bin/deploy-mirror.sh rollback
```

---

## 七、以后接入其他服务（后端 B / AI 服务）

现在这套只服务前端。后续接入时建议改造成通用结构：

```
/etc/deploy/services/<服务名>.conf         每个服务一份配置
/usr/local/bin/deploy.sh <服务名> <包>      统一的发布/回滚脚本
```

配置里指定：仓库名、产物名、部署模式（`static` / `jar` / `script`）、
目标目录、发布后动作（nginx reload 或 systemd restart）。

改造时前端这部分逻辑不用动，只需要把现有两个脚本包一层即可。
