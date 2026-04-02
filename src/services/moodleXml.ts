import { Quiz, Question, Option } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sanitizes a string for XML by removing invalid control characters.
 */
function sanitizeXmlString(str: string): string {
  if (!str) return '';
  // Remove non-printable control characters except common whitespace (tab, newline, carriage return)
  // Valid XML 1.0 characters: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
  let sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Also remove unusual Unicode line terminators (Line Separator \u2028 and Paragraph Separator \u2029)
  // These often cause issues in text editors and some XML parsers.
  sanitized = sanitized.replace(/[\u2028\u2029]/g, '\n');
  
  return sanitized;
}

/**
 * Escapes special characters for XML.
 */
function escapeXml(unsafe: string): string {
  return sanitizeXmlString(unsafe).replace(/[<>&"']/g, (m) => {
    switch (m) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return m;
    }
  });
}

/**
 * Escapes text for use inside a CDATA section.
 * CDATA cannot contain the sequence "]]>".
 */
function escapeCdata(text: string): string {
  return sanitizeXmlString(text).replace(/]]>/g, ']]&gt;<![CDATA[');
}

/**
 * Exports a Quiz object to Moodle XML format.
 */
export function exportToMoodleXml(quiz: Quiz): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<quiz>\n';

  // Add a category for the quiz title
  xml += '  <question type="category">\n';
  xml += `    <category><text>$course$/top/${escapeXml(quiz.title).replace(/[^a-zA-Z0-9]/g, '_')}</text></category>\n`;
  xml += '  </question>\n';

  quiz.questions.forEach((q) => {
    let type = 'multichoice';
    if (q.type === 'true-false') type = 'truefalse';
    if (q.type === 'info') type = 'description';

    xml += `  <question type="${type}">\n`;
    xml += `    <name><text>${escapeXml(q.text)}</text></name>\n`;
    xml += `    <questiontext format="html">\n`;
    xml += `      <text><![CDATA[<p><strong>${escapeCdata(q.text)}</strong></p>`;
    
    if (q.content) {
      xml += `<p>${escapeCdata(q.content).replace(/\n/g, '<br/>')}</p>`;
    }

    if (q.media) {
      if (q.media.type === 'image') {
        xml += `<p><img src="${sanitizeXmlString(q.media.url)}" alt="Question Image" /></p>`;
      } else {
        xml += `<p><video controls><source src="${sanitizeXmlString(q.media.url)}" /></video></p>`;
      }
    }
    
    xml += `]]></text>\n`;
    xml += `    </questiontext>\n`;
    xml += `    <generalfeedback format="html"><text><![CDATA[${escapeCdata(q.explanation || '')}]]></text></generalfeedback>\n`;
    xml += `    <defaultgrade>1.0000000</defaultgrade>\n`;
    xml += `    <penalty>0.3333333</penalty>\n`;
    xml += `    <hidden>0</hidden>\n`;
    xml += `    <idnumber></idnumber>\n`;
    
    if (q.isScenario) xml += `    <is_scenario>true</is_scenario>\n`;
    if (q.showScenario) xml += `    <show_scenario>true</show_scenario>\n`;

    if (q.type !== 'true-false') {
      xml += `    <single>${q.type === 'single-choice' ? 'true' : 'false'}</single>\n`;
      xml += `    <shuffleanswers>true</shuffleanswers>\n`;
      xml += `    <answernumbering>abc</answernumbering>\n`;
      xml += `    <showstandardinstruction>0</showstandardinstruction>\n`;
      
      const correctCount = q.options.filter(o => o.isCorrect).length;
      const fraction = q.type === 'single-choice' ? 100 : (100 / correctCount);
      const incorrectFraction = q.type === 'multiple-choice' ? -100 : 0; // Moodle often uses negative for wrong in multi-choice

      q.options.forEach((opt) => {
        xml += `    <answer fraction="${opt.isCorrect ? fraction.toFixed(7) : incorrectFraction.toFixed(7)}" format="html">\n`;
        xml += `      <text><![CDATA[${escapeCdata(opt.text)}]]></text>\n`;
        xml += `      <feedback format="html"><text></text></feedback>\n`;
        xml += `    </answer>\n`;
      });
    } else {
      // True/False specific
      const trueOpt = q.options.find(o => o.text.toLowerCase() === 'true');
      const falseOpt = q.options.find(o => o.text.toLowerCase() === 'false');
      
      if (trueOpt) {
        xml += `    <answer fraction="${trueOpt.isCorrect ? '100' : '0'}" format="html">\n`;
        xml += `      <text>true</text>\n`;
        xml += `      <feedback format="html"><text></text></feedback>\n`;
        xml += `    </answer>\n`;
      }
      if (falseOpt) {
        xml += `    <answer fraction="${falseOpt.isCorrect ? '100' : '0'}" format="html">\n`;
        xml += `      <text>false</text>\n`;
        xml += `      <feedback format="html"><text></text></feedback>\n`;
        xml += `    </answer>\n`;
      }
    }

    xml += '  </question>\n';
  });

  xml += '</quiz>';
  return xml;
}

/**
 * Parses Moodle XML format into a Quiz object.
 * Note: This is a simplified parser for the specific subset we support.
 */
export function importFromMoodleXml(xmlContent: string): Quiz {
  const sanitizedContent = sanitizeXmlString(xmlContent);
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(sanitizedContent, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    console.error('XML Parsing Error:', parserError.textContent);
    throw new Error('Failed to parse the XML file. Please ensure it is a valid Moodle XML file.');
  }

  const quizTitleNode = xmlDoc.querySelector('question[type="category"] category text');
  const quizTitle = quizTitleNode?.textContent?.split('/').pop()?.replace(/_/g, ' ') || 'Imported Quiz';

  const questions: Question[] = [];
  const questionNodes = xmlDoc.querySelectorAll('question:not([type="category"])');

  questionNodes.forEach((node) => {
    const typeAttr = node.getAttribute('type');
    const nameText = node.querySelector('name text')?.textContent?.trim() || '';
    const rawHtml = node.querySelector('questiontext text')?.textContent || '';
    
    // Improved question text extraction: try to find the strong tag first for info blocks
    const strongMatch = rawHtml.match(/<strong>(.*?)<\/strong>/);
    const extractedTitle = strongMatch ? strongMatch[1].replace(/<[^>]*>/g, '').trim() : nameText;
    
    const questionText = rawHtml.replace(/<[^>]*>/g, '').trim() || '';
    const explanation = node.querySelector('generalfeedback text')?.textContent?.trim() || '';
    const isScenario = node.querySelector('is_scenario')?.textContent === 'true';
    const showScenario = node.querySelector('show_scenario')?.textContent === 'true';
    
    // Try to extract media from CDATA/HTML if present
    let media: Question['media'] = undefined;
    
    const imgMatch = rawHtml.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) {
      media = { type: 'image', url: imgMatch[1] };
    } else {
      const videoMatch = rawHtml.match(/<video[^>]+src="([^">]+)"/);
      if (videoMatch) {
        media = { type: 'video', url: videoMatch[1] };
      }
    }

    let type: Question['type'] = 'single-choice';
    let content: string | undefined = undefined;

    if (typeAttr === 'truefalse') {
      type = 'true-false';
    } else if (typeAttr === 'multichoice') {
      const single = node.querySelector('single')?.textContent;
      type = single === 'false' ? 'multiple-choice' : 'single-choice';
    } else if (typeAttr === 'description') {
      type = 'info';
      // For info blocks, we try to extract the content by removing the title from the full text
      if (questionText.startsWith(extractedTitle)) {
        content = questionText.substring(extractedTitle.length).trim();
      } else if (questionText.startsWith(nameText)) {
        content = questionText.substring(nameText.length).trim();
      } else {
        content = questionText;
      }
    }

    const options: Option[] = [];
    const answerNodes = node.querySelectorAll('answer');
    answerNodes.forEach((ans) => {
      const fraction = parseFloat(ans.getAttribute('fraction') || '0');
      let text = ans.querySelector('text')?.textContent || '';
      if (type === 'true-false') {
        if (text.toLowerCase() === 'true') text = 'True';
        if (text.toLowerCase() === 'false') text = 'False';
      }
      options.push({
        id: uuidv4(),
        text: text,
        isCorrect: fraction > 0
      });
    });

    questions.push({
      id: uuidv4(),
      type,
      text: type === 'info' ? extractedTitle : questionText,
      content: content,
      explanation: explanation || undefined,
      options,
      media,
      isScenario,
      showScenario
    });
  });

  return {
    id: uuidv4(),
    title: quizTitle,
    description: 'Imported from Moodle XML',
    passingScore: 80,
    questions
  };
}
