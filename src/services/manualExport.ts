import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType
} from 'docx';
import { saveAs } from 'file-saver';

export const generateUserManualDocx = async () => {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Aptos",
            size: 22, // 11pt
          },
        },
      },
    },
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: "QuizBuilder Pro: User Manual",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Introduction
          new Paragraph({
            text: "Introduction",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun("Welcome to QuizBuilder Pro, a powerful and intuitive authoring tool designed for educators, instructional designers, and trainers. Whether you're building a simple knowledge check or a complex assessment for a Learning Management System (LMS), QuizBuilder Pro streamlines the process from creation to deployment."),
            ],
            spacing: { after: 200 },
          }),

          // Support & Contact
          new Paragraph({
            text: "Support & Contact",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun("Access the latest version of the tool at: "),
              new TextRun({ text: "https://ai.studio/apps/6d1e1109-8074-4613-babe-daf966341177", italics: true }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun("For questions about using the tool, technical support, or feedback, please contact "),
              new TextRun({ text: "Will Findlay", bold: true }),
              new TextRun(" at "),
              new TextRun({ text: "wfindlay@gmail.com", italics: true }),
              new TextRun("."),
            ],
            spacing: { after: 200 },
          }),

          // Feature Summary
          new Paragraph({
            text: "Feature Summary",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({ text: "• Versatile Content: Support for multiple question types and non-graded information blocks.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Smart Paste: Bulk-entry tool for rapid question and option creation.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Rich Media: Seamless integration of images and videos via URL.", spacing: { after: 50 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "Real-time Preview: ", bold: true }),
              new TextRun("Instant testing from the student's perspective. You can choose to preview the entire quiz from the beginning or start specifically from the question you are currently editing using the dropdown on the Preview button."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({ text: "• Cloud Connectivity: Secure draft syncing for cross-device access.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Flexible Data Handling: Bulk import from CSV/Excel and diverse export options (SCORM 2004, Word, etc.).", spacing: { after: 50 } }),
          new Paragraph({ text: "• Security & Feedback: Optional data encryption and configurable immediate feedback modes.", spacing: { after: 200 } }),

          // Interface Overview
          new Paragraph({
            text: "Interface Overview",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Sidebar (Left): ", bold: true }),
              new TextRun("Manage your question list, reorder questions with drag-and-drop, and add new questions or information blocks."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Editor (Center): ", bold: true }),
              new TextRun("The main workspace where you craft your questions, add options, and include media like images or videos."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Settings (Right): ", bold: true }),
              new TextRun("Configure quiz-wide settings like encryption, immediate feedback, and access various export options."),
            ],
            spacing: { after: 200 },
          }),

          // Advanced Editing & Smart Paste
          new Paragraph({
            text: "Advanced Editing & Smart Paste",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Smart Paste (Bulk Entry): ", bold: true }),
              new TextRun("Click the 'Smart Paste' button on any question to open the bulk entry tool. This is the fastest way to build questions:"),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({ text: "• Question + Options: Paste your entire question and its choices. The tool automatically detects where the question ends and the options begin.", spacing: { after: 50 }, bullet: { level: 0 } }),
          new Paragraph({ text: "• Options Only: If you leave the first line blank, the tool assumes you are only pasting a list of options for the current question.", spacing: { after: 50 }, bullet: { level: 0 } }),
          new Paragraph({ text: "• Marking Correct Answers: Use an asterisk (*) at the start of an option (e.g., '* B. Paris') to automatically mark it as the correct answer during paste.", spacing: { after: 50 }, bullet: { level: 0 } }),
          new Paragraph({ text: "• Single-Choice Enforcement: If you mark multiple options as correct for a single-choice question, the tool will mark only the first one and notify you.", spacing: { after: 100 }, bullet: { level: 0 } }),
          
          new Paragraph({
            children: [
              new TextRun({ text: "Intelligent Individual Pasting: ", bold: true }),
              new TextRun("When pasting text into the Question field or an Option field, the tool automatically strips common prefixes like '1. ', 'Question 1: ', 'A. ', or 'b) ', keeping your content clean and consistent."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Optimized Option Workflow: ", bold: true }),
              new TextRun("When you click 'Add Option', the new field is automatically focused and its placeholder text is selected, allowing you to start typing or pasting immediately without extra clicks."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Question Type Conversion: ", bold: true }),
              new TextRun("Easily switch between Single Answer and Multiple Answer Multiple Choice questions using the 'Switch to...' button next to the question type label. When converting from Multiple to Single, the tool intelligently keeps only the first correct answer to maintain validity."),
            ],
            spacing: { after: 200 },
          }),

          // Content Types & Psychometric Guidance
          new Paragraph({
            text: "Content Types & Psychometric Guidance",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "QuizBuilder Pro supports four main types of content. Choose the format that best aligns with your learning objectives:",
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1. True / False: ", bold: true }),
              new TextRun("A simple binary choice. Best for assessing factual knowledge, but use sparingly in critical assessments due to the 50% guessing probability."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2. Single Answer Multiple Choice: ", bold: true }),
              new TextRun("The 'gold standard' for objective testing. With four options, the guessing probability drops to 25%. Ideal for measuring recall and application."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3. Multiple Answer Multiple Choice: ", bold: true }),
              new TextRun("Requires higher cognitive processing as students evaluate every option independently. This format significantly reduces guessing and is ideal for complex scenarios."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4. Information Block: ", bold: true }),
              new TextRun("Non-graded content used to provide context, instructions, or study material. Use these to break up long quizzes and provide 'Check Your Knowledge' moments."),
            ],
            spacing: { after: 200 },
          }),

          // Media, Feedback & Security
          new Paragraph({
            text: "Media, Feedback & Security",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Media Integration: ", bold: true }),
              new TextRun("Enhance questions with images or videos by pasting a URL. Perfect for visual identification or video-based case studies."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Immediate Feedback: ", bold: true }),
              new TextRun("When enabled, students see results immediately after each question. This formative mode prevents backward navigation to maintain feedback integrity."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Data Encryption: ", bold: true }),
              new TextRun("Obfuscates quiz content within exported files to prevent students from 'peeking' at answers via the source code."),
            ],
            spacing: { after: 200 },
          }),

          // Import and Export Formats
          new Paragraph({
            text: "Import and Export Formats",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• CSV/Excel Import: ", bold: true }),
              new TextRun("Quickly bring in large question banks. Use the provided template format to ensure headers match."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• SCORM 2004: ", bold: true }),
              new TextRun("The industry standard for Learning Management Systems. This format tracks completion and scoring."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Excel Export (Storyline/Quizmaker): ", bold: true }),
              new TextRun("Specifically formatted for users who want to import their questions into Articulate Storyline or Quizmaker for further customization."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Word/PDF: ", bold: true }),
              new TextRun("Ideal for creating physical answer keys, SME reviews, or offline study guides. These exports now include any images attached to your questions."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Moodle XML: ", bold: true }),
              new TextRun("Direct compatibility with Moodle's question bank system."),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "• Standalone HTML: ", bold: true }),
              new TextRun("A single file that contains the entire quiz, playable in any web browser without an LMS."),
            ],
            spacing: { after: 200 },
          }),

          // Workflows and Scenarios
          new Paragraph({
            text: "Workflows and Scenarios",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),

          // Scenario 1
          new Paragraph({
            text: "Scenario 1: Creating a Quiz from Scratch for an LMS that supports SCORM 2004",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: "1. Open QuizBuilder Pro and click 'New Quiz'.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "2. Enter your quiz title and description in the sidebar.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "3. Use the 'Add Question' buttons to build your assessment.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "4. In the Settings panel, ensure 'Show Immediate Feedback' is toggled based on your instructional design.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "5. Click 'Export SCORM 2004'. This will download a .zip file.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "6. Log in to an LMS that supports SCORM 2004, navigate to the Content Uploader, and upload the .zip file as a SCORM course.",
            spacing: { after: 200 },
          }),

          // Scenario 2
          new Paragraph({
            text: "Scenario 2: CSV Import and Answer Key Generation",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: "1. If you have questions in an Excel or CSV file, click 'Import CSV' in the Settings panel.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "2. Once imported, review the questions in the sidebar. You can add images to specific questions to make them more engaging.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "3. To create a physical or digital answer key for your records, click 'Export to Word'.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "4. The resulting Word document will list all questions, options, and clearly mark the correct answers in bold.",
            spacing: { after: 200 },
          }),

          // Scenario 3
          new Paragraph({
            text: "Scenario 3: SME Review and Final Deployment",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: "1. Export your quiz to Word and send the document to your Subject Matter Expert (SME).",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "2. The SME reviews the content and uses Word's 'Track Changes' or comments to suggest revisions.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "3. Open QuizBuilder Pro, load your quiz from the Cloud (if saved), and apply the SME's revisions.",
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: "4. Once finalized, export as a SCORM module for your LMS or as an HTML file for a standalone web link.",
            spacing: { after: 200 },
          }),

          // Best Practices & Avoiding Pitfalls
          new Paragraph({
            text: "Best Practices & Avoiding Pitfalls",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({ text: "• Validate Content: Ensure at least one correct answer is marked per question. Provide clear explanations to maximize learning.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Verify Media: Always test image/video URLs for public accessibility and HTTPS compliance.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Preview Frequently: Use the 'Preview' mode to catch typos, logical errors, and experience the quiz as a student would.", spacing: { after: 50 } }),
          new Paragraph({ text: "• Manage Content: Keep Information Blocks concise. Save drafts to the Cloud regularly to prevent progress loss.", spacing: { after: 200 } }),

          // Legal Disclaimer
          new Paragraph({
            text: "Legal Disclaimer",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Important Notice: ", bold: true }),
              new TextRun("QuizBuilder Pro is an experimental tool provided 'as is' without any guarantees or warranties of any kind. The author does not guarantee that the tool will be free of errors, bugs, or interruptions. By using this tool, you acknowledge that the author shall not be held liable for any issues, data loss, or damages arising from its use, including but not limited to technical failures, incorrect quiz exports, or LMS compatibility issues. Use at your own risk."),
            ],
            spacing: { after: 200 },
          }),

          // Footer
          new Paragraph({
            text: "Generated by QuizBuilder Pro v1.0",
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "QuizBuilder_Pro_User_Manual.docx");
};
