// 前端流水线（Mu-mirror-F）
//
// 触发：仓库 webhook push（或 Jenkins 多分支流水线扫描）
// 部署：构建 dist → 原子软链切换，零中断。回滚 = 再切一次链，秒级。
pipeline {
  agent any

  options {
    timestamps()
    // 2C2G 机器上这条是硬约束：两个构建并行必 OOM，会连累同机的 PG / 另一个项目
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 15, unit: 'MINUTES')
  }

  environment {
    MIRROR_HOME = '/opt/mirror'
    // 限制 vite / rollup 的 Node 堆，给同机服务留活路
    NODE_OPTIONS = '--max-old-space-size=384'
  }

  stages {
    stage('构建') {
      steps {
        // 用 install 而不是 ci：2C2G 上 ci 会先删干净再全量重装，IO 和内存峰值明显更高
        sh 'npm install --no-audit --no-fund'
        sh 'npm run build'
      }
    }

    stage('发布') {
      steps {
        sh 'bash deploy/frontend-release.sh'
      }
    }
  }

  post {
    success { echo '前端发布成功（静态文件已原子切换，用户刷新即新版）' }
    failure { echo '前端发布失败：current 软链未切换，线上仍是上一版，无需回滚' }
  }
}
