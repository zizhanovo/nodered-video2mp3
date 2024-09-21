const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

module.exports = function (RED) {
    function VideoToMp3Node(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // 从配置中获取字段名称
        const configFilePath = config.filePath;
        const absoluteOutputField = config.absoluteOutput || 'absolutePath';
        const relativeOutputField = config.relativeOutput || 'relativePath';

        node.on('input', function (msg, send, done) {
            try {
                // 解析文件路径（从节点配置或消息中获取）
                let inputPath = RED.util.evaluateNodeProperty(configFilePath, config.filePathType, node, msg);
                
                // 验证输入路径是否为有效字符串
                if (typeof inputPath !== 'string' || inputPath.trim() === '') {
                    throw new Error('输入的文件路径无效。请检查节点的配置或输入消息。');
                }

                // 将相对路径转换为绝对路径
                if (!path.isAbsolute(inputPath)) {
                    inputPath = path.resolve(process.cwd(), inputPath);
                }

                // 规范化路径以防止路径问题
                inputPath = path.normalize(inputPath);

                // 检查文件是否存在以及是否为文件
                if (!fs.existsSync(inputPath)) {
                    throw new Error(`文件路径不存在: ${inputPath}`);
                }
                if (!fs.lstatSync(inputPath).isFile()) {
                    throw new Error(`路径不是有效文件: ${inputPath}`);
                }

                // 生成输出 MP3 文件路径
                const outputPath = path.join(
                    path.dirname(inputPath),
                    path.basename(inputPath, path.extname(inputPath)) + '.mp3'
                );

                // 检查 ffmpeg 是否正确加载
                if (!ffmpeg) {
                    throw new Error('ffmpeg 库未正确安装或不可用。');
                }

                // 开始使用 ffmpeg 进行转换
                ffmpeg(inputPath)
                    .output(outputPath)
                    .audioCodec('libmp3lame')
                    .on('end', function () {
                        node.log('文件已成功转换为 MP3: ' + outputPath);

                        // 计算相对路径（相对于当前工作目录）
                        const relativeOutputPath = path.relative(process.cwd(), outputPath);

                        // 将输出路径设置到 msg 对象中
                        RED.util.setMessageProperty(msg, absoluteOutputField, outputPath, true);
                        RED.util.setMessageProperty(msg, relativeOutputField, relativeOutputPath, true);

                        // 发送带有路径的 msg 对象
                        send(msg);
                        if (done) done(); // 确保 Node-RED 的消息流程可以继续
                    })
                    .on('error', function (err, stdout, stderr) {
                        // 更详细地记录 ffmpeg 的错误信息
                        node.error('文件转换为 MP3 时发生错误: ' + err.message, msg);
                        node.error('标准输出: ' + stdout);
                        node.error('标准错误输出: ' + stderr);
                        if (done) done(err); // 向 Node-RED 通知错误
                    })
                    .run();

            } catch (err) {
                // 捕获任何处理过程中的错误并记录详细信息
                node.error(`处理输入时发生错误: ${err.message}`, msg);
                node.error(err.stack); // 打印完整的错误堆栈信息
                if (done) done(err); // 如果提供了 done 回调，传递错误
            }
        });

        // 清理资源，确保在节点关闭时结束所有操作
        node.on('close', function () {
            node.log('节点关闭时，清理可能的资源。');
        });
    }

    // 注册视频转 MP3 的节点
    RED.nodes.registerType('video2mp3', VideoToMp3Node);
};
