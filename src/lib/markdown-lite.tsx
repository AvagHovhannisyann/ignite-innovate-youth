import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for AI chat replies: headings, bold/italic,
 * inline + fenced code, links, bullet/numbered lists. Builds React nodes
 * directly — no HTML strings, so model output can't inject markup.
 */

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // links | bold | italic | inline code
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[1] && m[2]) {
      out.push(
        <a
          key={key}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      out.push(<strong key={key}>{m[3]}</strong>);
    } else if (m[4]) {
      out.push(<em key={key}>{m[4]}</em>);
    } else if (m[5]) {
      out.push(
        <code key={key} className="rounded bg-secondary px-1 py-0.5 text-[0.85em] font-mono">
          {m[5]}
        </code>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownLite({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre
          key={key++}
          className="rounded-xl bg-secondary/70 border border-border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap"
        >
          {code.join("\n")}
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      blocks.push(
        <div key={key++} className="font-semibold mt-2 first:mt-0">
          {renderInline(heading[2], `h${key}`)}
        </div>,
      );
      i++;
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key++} className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `li${key}-${j}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph: consume consecutive non-empty, non-special lines
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push(
      <p key={key++} className="leading-relaxed">
        {para.map((l, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(l, `p${key}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}
