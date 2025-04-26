### 3. **什么是 Data URL？**

**Data URL** 是一种特殊的 URL 格式，用于直接在 URL 中嵌入数据，而不是通过外部文件引用。它通常用于嵌入小型资源（如图片、字体等），以减少 HTTP 请求。

#### Data URL 的格式

```
data:[<mediatype>][;base64],<data>
```

- **`data:`**: 固定前缀，表示这是一个 Data URL。
- **`<mediatype>`**: 可选，表示数据的 MIME 类型（如 `image/png`、`text/plain` 等）。如果省略，默认为 `text/plain;charset=US-ASCII`。
- **`;base64`**: 可选，表示数据是 Base64 编码的。如果省略，数据是 URL 编码的。
- **`<data>`**: 实际的数据内容。

#### 示例

- 一个嵌入 PNG 图片的 Data URL：
  ```html
  <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..." />
  ```
- 一个嵌入纯文本的 Data URL：
  ```html
  <a href="data:text/plain;charset=utf-8,Hello%20World!">Download</a>
  ```
