/** Optional source-supplied paragraphs shared by feeds and metrics. */
export const TextExtra = ({ text }: { text?: string[] }) =>
  Array.isArray(text) && text.length > 0 ? (
    <section className="extra-section">
      <h4>Additional information</h4>
      {text.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
      ))}
    </section>
  ) : null
