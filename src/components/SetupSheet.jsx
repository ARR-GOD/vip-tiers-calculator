import { createPortal } from 'react-dom';

// Printable setup sheet (see utils/setupSheet.js). Rendered straight into
// <body>: the print rules in index.css hide the app and show only this sheet,
// so the browser's "Save as PDF" keeps selectable text for Claude Cowork.
export default function SetupSheet({ sheet }) {
  return createPortal(
    <div className="print-sheet">
      <h1>{sheet.title}</h1>
      <p className="print-sheet-subtitle">{sheet.subtitle}</p>
      {sheet.sections.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.note && <p>{section.note}</p>}
          {section.facts && (
            <dl>
              {section.facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {section.columns && (section.rows.length > 0 ? (
            <table>
              <thead>
                <tr>{section.columns.map((col, i) => <th key={i}>{col}</th>)}</tr>
              </thead>
              <tbody>
                {section.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((value, c) => (
                      <td key={c}>
                        {Array.isArray(value)
                          ? <ul>{value.map(item => <li key={item}>{item}</li>)}</ul>
                          : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>—</p>)}
        </section>
      ))}
    </div>,
    document.body,
  );
}
