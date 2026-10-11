/** Optional source-supplied paragraphs shared by feeds and metrics. */
export const TextExtra = ({ text }: { text?: string[] }) =>
  Array.isArray(text) && text.length > 0 ? (
    <section className="extra-text">
      <h4 className="b-title">Additional information</h4>
      {text.map((paragraph, index) => (
        <p className="b-text" key={`${index}-${paragraph.slice(0, 20)}`}>
          {paragraph}
        </p>
      ))}
    </section>
  ) : null
