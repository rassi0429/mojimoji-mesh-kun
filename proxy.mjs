import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const app = express();
const proxy_base = process.env.PROXY_URL ?? "http://blender:8033";
const cacheDir = './cache';

// キャッシュディレクトリがなければ作成
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

/**
 * キャッシュキーを SHA-256 ハッシュ化してファイル名に変換
 * @param {string} text 
 * @param {string} font 
 * @returns {string} キャッシュファイルのパス
 */
function getCacheFilePath(text, font) {
    const hash = crypto.createHash('sha256').update(`text=${text}&font=${font}`).digest('hex');
    return path.join(cacheDir, `${hash}.meshx`);
}

/**
 * 指定された text, font を元に画像生成サーバからデータを取得する関数
 * @param {string} text 
 * @param {string} font 
 * @returns {Promise<Buffer>}
 */
async function fetchImage(text, font) {
    const url = `${proxy_base}/?text=${encodeURIComponent(text)}&font=${encodeURIComponent(font)}`;
    const proxy_response = await fetch(url);
    const binary = await proxy_response.arrayBuffer();
    return Buffer.from(binary);
}

app.get('/', async (req, res) => {
    console.log('Request:', req.query);
    const text = req.query.text;
    const font = req.query.font ?? "ackaisyo.ttf";

    if (!text) {
        return res.status(400).send('Missing text parameter');
    }

    const cacheFilePath = getCacheFilePath(text, font);

    // 既存のキャッシュがある場合はそれを返す
    if (fs.existsSync(cacheFilePath)) {
        console.log('Cache hit:', cacheFilePath);
        return res.sendFile(path.resolve(cacheFilePath));  // 修正: 絶対パスを指定
    }


    console.log('Cache miss:', cacheFilePath);

    try {
        const buffer = await fetchImage(text, font);

        // キャッシュとしてファイルに保存
        fs.writeFileSync(cacheFilePath, buffer);

        res.writeHead(200, {
            'Content-Type': "application/octet-stream",
            'Content-disposition': 'attachment;filename=text.meshx',
            'Content-Length': buffer.byteLength
        });
        res.end(buffer);
    } catch (err) {
        console.error('Error during image generation:', err);
        res.status(500).send('Error generating image');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
