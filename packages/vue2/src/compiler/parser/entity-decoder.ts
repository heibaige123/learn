let decoder

export default {
  /**
   * 解码 HTML 实体字符串为普通文本。
   *
   * @param html - 包含 HTML 实体的字符串。
   * @returns 解码后的普通文本字符串。
   */
  decode(html: string): string {
    decoder = decoder || document.createElement('div')
    decoder.innerHTML = html
    return decoder.textContent
  }
}
