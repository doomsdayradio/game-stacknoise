const titleNode = document.getElementById("insider-title");
const subtitleNode = document.getElementById("insider-subtitle");
const thesisNode = document.getElementById("insider-thesis");
const mapNode = document.getElementById("insider-map");
const summaryNode = document.getElementById("insider-summary");
const sectionsNode = document.getElementById("insider-sections");

const SUMMARY_CONFIG = [
  {
    title: "Signal",
    kicker: "Befund",
    match: ["signal", "rauschen", "archiv", "muster", "radioteleskope", "quantenprozessoren"],
  },
  {
    title: "Fortschritt",
    kicker: "Korrelation",
    match: ["technologische", "transistor", "kernspaltung", "netzwerke", "quantencomputer", "ki"],
  },
  {
    title: "Akteure",
    kicker: "Netzwerk",
    match: ["elite", "milit", "datenanalysten", "konzernlaboren", "entwicklungsprogrammen"],
  },
  {
    title: "Folge",
    kicker: "Risiko",
    match: ["invasion", "filter", "abh", "management", "rueckkopplungen", "test bestanden"],
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function splitParagraphs(block) {
  return block
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLikelyListItem(text) {
  return !/[.!?]$/.test(text) && text.length < 90;
}

function formatText(text) {
  return escapeHtml(text).replaceAll("\n", "<br />");
}

function extractSections(source) {
  const lines = source.replaceAll("\r", "").split("\n");
  const trimmed = lines.map((line) => line.trim());
  const title = trimmed.find((line) => line.length) ?? "Insider Dossier";

  const sections = [];
  let current = { heading: "", blocks: [] };
  let block = [];
  let seenFirstHeading = false;

  function flushBlock() {
    if (!block.length) {
      return;
    }
    current.blocks.push(block.join("\n"));
    block = [];
  }

  function isHeading(line) {
    if (!line) {
      return false;
    }
    if (line === title) {
      return false;
    }
    if (line.endsWith(".") || line.endsWith(":")) {
      return false;
    }
    return !line.includes("  ");
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushBlock();
      continue;
    }

    if (isHeading(line)) {
      flushBlock();
      if (seenFirstHeading || current.blocks.length) {
        sections.push(current);
      }
      current = { heading: line, blocks: [] };
      seenFirstHeading = true;
      continue;
    }

    block.push(line);
  }

  flushBlock();
  if (current.heading || current.blocks.length) {
    sections.push(current);
  }

  const intro = sections.length && sections[0].heading === "" ? sections.shift() : { heading: "", blocks: [] };
  return { title, intro, sections };
}

function findSectionByKeywords(sections, keywords) {
  return sections.find((section) => {
    const haystack = normalize([section.heading, ...section.blocks].join(" "));
    return keywords.some((keyword) => haystack.includes(normalize(keyword)));
  });
}

function buildSummaryCards(data) {
  summaryNode.innerHTML = "";

  for (const config of SUMMARY_CONFIG) {
    const matchedSection = findSectionByKeywords(data.sections, config.match);
    const copy = matchedSection?.blocks?.[0] ?? "Keine passende Sektion in theorie.md gefunden.";

    const card = document.createElement("article");
    card.className = "insider-card panel";
    card.innerHTML = `
      <p class="insider-card-kicker">${escapeHtml(config.kicker)}</p>
      <h2>${escapeHtml(config.title)}</h2>
      <p>${formatText(copy)}</p>
    `;
    summaryNode.append(card);
  }
}

function buildSignalMap(sections) {
  mapNode.innerHTML = "";

  sections.forEach((section, index) => {
    const item = document.createElement("li");
    item.dataset.step = String(index + 1);
    item.textContent = section.heading || `Abschnitt ${index + 1}`;
    mapNode.append(item);
  });
}

function renderCopyBlocks(blocks) {
  const copy = document.createElement("div");
  copy.className = "insider-copy";

  for (const block of blocks) {
    const paragraphs = splitParagraphs(block);
    const asList = paragraphs.length >= 2 && paragraphs.every(isLikelyListItem);

    if (asList) {
      const list = document.createElement("ul");
      list.className = "insider-list";
      for (const line of paragraphs) {
        const item = document.createElement("li");
        item.innerHTML = formatText(line);
        list.append(item);
      }
      copy.append(list);
      continue;
    }

    const paragraph = document.createElement("p");
    paragraph.innerHTML = formatText(paragraphs.join(" "));
    copy.append(paragraph);
  }

  return copy;
}

function collectSignals(blocks) {
  return blocks
    .flatMap((block) => splitParagraphs(block))
    .filter((line) => isLikelyListItem(line))
    .slice(0, 5);
}

function buildSections(data) {
  sectionsNode.innerHTML = "";

  for (const section of data.sections) {
    const article = document.createElement("article");
    article.className = "insider-section panel";

    const header = document.createElement("header");
    header.className = "insider-section-header";
    header.innerHTML = `
      <p class="insider-section-kicker">Dossier-Abschnitt</p>
      <h2>${escapeHtml(section.heading)}</h2>
      <p class="insider-section-intro">${formatText(section.blocks[0] ?? "")}</p>
    `;

    const grid = document.createElement("div");
    grid.className = "insider-section-grid";
    grid.append(renderCopyBlocks(section.blocks.slice(1).length ? section.blocks.slice(1) : section.blocks));

    const signals = collectSignals(section.blocks);
    const detail = document.createElement("aside");
    detail.className = "insider-detail";
    detail.innerHTML = `<h3>Extrahierte Marker</h3>`;

    if (signals.length) {
      const list = document.createElement("ul");
      list.className = "insider-list";
      for (const signal of signals) {
        const item = document.createElement("li");
        item.innerHTML = formatText(signal);
        list.append(item);
      }
      detail.append(list);
    } else {
      const fallback = document.createElement("p");
      fallback.textContent = "Dieser Abschnitt arbeitet vor allem mit Fliesstext statt mit isolierten Markern.";
      detail.append(fallback);
    }

    grid.append(detail);
    article.append(header, grid);
    sectionsNode.append(article);
  }

  if (!data.sections.length) {
    sectionsNode.innerHTML = '<div class="insider-empty">Keine Abschnitte in theorie.md gefunden.</div>';
  }
}

function renderDossier(data) {
  titleNode.textContent = data.title;
  subtitleNode.textContent =
    "Aufbereitet als internes Lagebild: vom Signalbefund ueber die Akteure bis zur strukturellen Invasion.";
  thesisNode.textContent = data.intro.blocks[0] ?? "Keine Einleitung in theorie.md gefunden.";

  buildSignalMap(data.sections);
  buildSummaryCards(data);
  buildSections(data);
}

async function loadDossier() {
  try {
    const response = await fetch("./theorie.md", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const source = await response.text();
    renderDossier(extractSections(source));
  } catch (error) {
    titleNode.textContent = "Dossier konnte nicht geladen werden";
    subtitleNode.textContent = "theorie.md ist derzeit nicht verfuegbar.";
    thesisNode.textContent = "Der Insider-Bereich hat keine Quelle erhalten.";
    summaryNode.innerHTML = "";
    mapNode.innerHTML = "";
    sectionsNode.innerHTML = `<div class="insider-error">${escapeHtml(String(error))}</div>`;
  }
}

loadDossier();
