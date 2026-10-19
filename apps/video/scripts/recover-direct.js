#!/usr/bin/env node

/**
 * 直接从 Cloudflare D1 和 evolink API 恢复视频
 */

const dotenv = require("dotenv");
const { executeD1, sqlValue } = require("./d1-cli");

// 加载环境变量
dotenv.config({ path: ".env.local" });

const EVOLINK_API_KEY = process.env.EVOLINK_API_KEY;

async function checkEvolinkTask(taskId) {
  const response = await fetch(
    `https://api.evolink.ai/v1/tasks/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${EVOLINK_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

function updateVideoStatus(videoUuid, status, videoUrl, thumbnailUrl, errorMessage) {
  executeD1(`
    UPDATE videos
    SET
      status = ${sqlValue(status)},
      video_url = ${sqlValue(videoUrl)},
      thumbnail_url = ${sqlValue(thumbnailUrl)},
      error_message = ${sqlValue(errorMessage)},
      updated_at = unixepoch(),
      completed_at = unixepoch()
    WHERE uuid = ${sqlValue(videoUuid)}
  `);
}

async function main() {
  console.log("🔍 恢复卡住的视频...\n");

  try {
    // 查找卡住的视频
    const stuckVideos = executeD1(`
      SELECT uuid, status, provider, external_task_id
      FROM videos
      WHERE status IN ('PENDING', 'GENERATING', 'UPLOADING')
      ORDER BY created_at DESC
      LIMIT 20
    `);

    if (stuckVideos.length === 0) {
      console.log("✅ 没有卡住的视频");
      return;
    }

    console.log(`📊 发现 ${stuckVideos.length} 个未完成的视频\n`);

    for (const video of stuckVideos) {
      console.log(`📋 检查视频: ${video.uuid}`);
      console.log(`   当前状态: ${video.status}`);
      console.log(`   任务ID: ${video.external_task_id || "N/A"}`);

      if (!video.external_task_id) {
        console.log(`   ⏭️  跳过（无任务ID）\n`);
        continue;
      }

      try {
        // 查询 evolink 状态
        const task = await checkEvolinkTask(video.external_task_id);
        console.log(`   Evolink 状态: ${task.status}`);

        if (task.status === "completed" && task.results && task.results[0]) {
          console.log(`   ✅ 任务已完成！`);
          console.log(`   视频URL: ${task.results[0]}`);

          // 更新数据库
          updateVideoStatus(
            video.uuid,
            "COMPLETED",
            task.results[0],
            task.data?.thumbnail_url,
            null
          );

          console.log(`   💾 已更新数据库为 COMPLETED\n`);
        } else if (task.status === "failed") {
          console.log(`   ❌ 任务已失败`);

          const errorMsg = task.error?.message || "Task failed";

          updateVideoStatus(
            video.uuid,
            "FAILED",
            null,
            null,
            errorMsg
          );

          console.log(`   💾 已更新数据库为 FAILED\n`);
        } else {
          console.log(`   ⏳ 任务仍在处理中...\n`);
        }
      } catch (error) {
        console.error(`   ❌ 查询失败: ${error.message}\n`);
      }
    }

    console.log("✅ 恢复完成");
  } catch (error) {
    console.error("❌ 错误:", error);
    throw error;
  }
}

main().catch(console.error);
