# pdf2md API

PDF を Markdown に変換する API サーバーです。`@opendocsg/pdf2md` を利用しています。

- 使用ライブラリ: https://github.com/opendocsg/pdf2md

## 起動

```bash
docker compose up --build
```

## 変換

```bash
curl -F "file=@sample.pdf" "http://localhost:8080/convert"
```

生の Markdown が欲しい場合は `?format=raw` を付けます。

```bash
curl -F "file=@sample.pdf" "http://localhost:8080/convert?format=raw"
```

## ヘルスチェック

```bash
curl "http://localhost:8080/healthz"
```
