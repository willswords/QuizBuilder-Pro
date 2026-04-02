import { Question, QuestionType, Option } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const parseMsFormsHtml = (htmlContent: string): Question[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const questions: Question[] = [];
  
  // 1. Try to find JSON data in script tags (most reliable if present)
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';
    if (content.includes('"questions":[') || content.includes('questions:[')) {
      try {
        // Try to extract the JSON object
        const match = content.match(/({.*"questions":\s*\[.*})/s) || 
                      content.match(/({.*questions:\s*\[.*})/s);
        
        if (match) {
          // Clean up the match if it's part of an assignment
          let jsonStr = match[1];
          // If it ends with a semicolon or other JS junk, try to trim it
          const lastBrace = jsonStr.lastIndexOf('}');
          if (lastBrace !== -1) {
            jsonStr = jsonStr.substring(0, lastBrace + 1);
          }

          const data = JSON.parse(jsonStr);
          const rawQuestions = data.questions || data.form?.questions || data.initialState?.form?.questions;
          
          if (Array.isArray(rawQuestions)) {
            rawQuestions.forEach((q: any) => {
              const options: Option[] = [];
              // Try multiple choice property names
              const rawChoices = q.choices || q.answerChoices || q.options || q.items || q.choiceList;
              
              if (Array.isArray(rawChoices)) {
                rawChoices.forEach((c: any) => {
                  const choiceText = c.text || c.title || c.description || (typeof c === 'string' ? c : '');
                  if (choiceText) {
                    options.push({
                      id: uuidv4(),
                      text: choiceText,
                      isCorrect: !!c.isCorrect || !!c.is_correct || !!c.isAnswer || !!c.is_answer
                    });
                  }
                });
              }

              let type: QuestionType = 'single-choice';
              const qType = q.type || q.questionType || q.kind;
              
              if (qType === 'Question.Choice' || qType === 'Choice' || qType === 1 || qType === '1') {
                type = (q.isMultipleChoice || q.multipleSelection) ? 'multiple-choice' : 'single-choice';
              } else if (qType === 'Question.Info' || qType === 'Info' || qType === 0 || qType === '0') {
                type = 'info';
              } else if (options.length > 0) {
                // Heuristic if type is unknown
                type = (q.isMultipleChoice || q.multipleSelection) ? 'multiple-choice' : 'single-choice';
              } else {
                type = 'info';
              }

              questions.push({
                id: uuidv4(),
                type,
                text: q.title || q.text || q.questionText || 'Untitled Question',
                content: q.description || q.subtitle || q.infoContent || '',
                options,
              });
            });

            if (questions.length > 0) return questions;
          }
        }
      } catch (e) {
        console.warn('Failed to parse JSON from script tag', e);
      }
    }
  }

  // 1.5 Try to find JSON in the whole HTML string if script tags failed
  if (questions.length === 0) {
    try {
      const genericMatch = htmlContent.match(/{"questions":\s*\[(.*?)\]}/s);
      if (genericMatch) {
        const jsonStr = genericMatch[0];
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data.questions)) {
          data.questions.forEach((q: any) => {
            const options: Option[] = [];
            if (Array.isArray(q.choices)) {
              q.choices.forEach((c: any) => {
                options.push({
                  id: uuidv4(),
                  text: c.text || '',
                  isCorrect: !!c.isCorrect
                });
              });
            }
            questions.push({
              id: uuidv4(),
              type: q.isMultipleChoice ? 'multiple-choice' : 'single-choice',
              text: q.title || 'Untitled Question',
              options
            });
          });
          if (questions.length > 0) return questions;
        }
      }
    } catch (e) {
      // Ignore generic JSON failures
    }
  }

  // 2. Fallback to DOM Scraping with more selectors
  const selectors = [
    '[data-automation-id="questionArea"]',
    '.office-form-question',
    '.question-view',
    '.office-form-question-content',
    '.office-form-question-main',
    '[role="listitem"]', // Common for questions in some views
    '.office-form-question-wrapper'
  ];

  let questionElements: Element[] = [];
  for (const selector of selectors) {
    const found = Array.from(doc.querySelectorAll(selector));
    if (found.length > 0) {
      questionElements = found;
      break;
    }
  }

  // 3. Even more desperate: look for anything with a question title
  if (questionElements.length === 0) {
    const titleElements = doc.querySelectorAll('[data-automation-id="questionTitle"], .office-form-question-title, .question-title');
    if (titleElements.length > 0) {
      titleElements.forEach(titleEl => {
        // Try to find the container
        const container = titleEl.closest('div[class*="question"], div[id*="question"]') || titleEl.parentElement;
        if (container) questionElements.push(container);
      });
    }
  }

  if (questionElements.length === 0) {
    // Final check: Is it definitely a shell page?
    const isShell = htmlContent.includes('window.OfficeFormServerInfo') && 
                   !htmlContent.includes('data-automation-id="questionArea"') &&
                   !htmlContent.includes('office-form-question');
    
    if (isShell) {
      throw new Error('This HTML file contains the Microsoft Forms loading screen but no question data. \n\nTo import correctly:\n1. Open the form in your browser.\n2. Wait until you can see all the questions on the screen.\n3. Press Ctrl+S (or Cmd+S) and save as "Webpage, Complete".\n4. Upload that saved file here.');
    }
    
    throw new Error('No questions found in this HTML file. Please make sure you are exporting a fully loaded Microsoft Form page where the questions are visible.');
  }

  // Process found elements
  questionElements.forEach((qEl, index) => {
    const titleEl = qEl.querySelector('[data-automation-id="questionTitle"], .office-form-question-title, .question-title, h3, h4');
    if (!titleEl) return;
    
    let text = titleEl.textContent?.trim() || `Question ${index + 1}`;
    // Remove numbering if present (e.g. "1. Question text")
    text = text.replace(/^\d+[\.\s]+/, '');
    
    const options: Option[] = [];
    
    // Look for choices
    const choiceSelectors = [
      '[data-automation-id="choiceContent"]',
      '.office-form-question-choice-text',
      '.office-form-question-choice-content',
      '.office-form-question-choice',
      'span[data-automation-id="choiceText"]',
      '.choice-content',
      'label span',
      'label div',
      '.office-form-question-choice-label'
    ];

    let choiceElements: Element[] = [];
    for (const selector of choiceSelectors) {
      const found = Array.from(qEl.querySelectorAll(selector));
      // Filter out empty elements or elements that are just containers
      const validFound = found.filter(el => el.textContent?.trim().length || el.querySelector('input'));
      if (validFound.length > 0) {
        choiceElements = validFound;
        break;
      }
    }

    choiceElements.forEach(choiceEl => {
      let choiceText = choiceEl.textContent?.trim() || '';
      
      // If choice text is empty, check for input value or sibling text
      if (!choiceText) {
        const input = choiceEl.querySelector('input');
        if (input && input.value) choiceText = input.value;
      }

      if (choiceText && choiceText.length < 500) {
        const isCorrect = !!choiceEl.closest('.is-correct') || 
                          !!choiceEl.closest('[class*="correct"]') ||
                          !!choiceEl.parentElement?.querySelector('[data-icon-name="CheckMark"]') ||
                          !!choiceEl.parentElement?.querySelector('.office-form-question-choice-correct-icon') ||
                          !!choiceEl.querySelector('[data-icon-name="CheckMark"]') ||
                          !!choiceEl.querySelector('.office-form-question-choice-correct-icon');

        options.push({
          id: uuidv4(),
          text: choiceText,
          isCorrect
        });
      }
    });
    
    // Determine type
    let type: QuestionType = options.length > 0 ? 'single-choice' : 'info';
    
    // Check for checkboxes (Multiple Choice)
    const hasCheckboxes = !!qEl.querySelector('input[type="checkbox"]') || 
                         !!qEl.querySelector('[role="checkbox"]') ||
                         !!qEl.querySelector('.office-form-question-choice-checkbox') ||
                         !!qEl.querySelector('[class*="checkbox"]');
    
    if (hasCheckboxes && options.length > 0) {
      type = 'multiple-choice';
    }
    
    // Check for True/False (heuristic)
    if (options.length === 2) {
      const texts = options.map(o => o.text.toLowerCase());
      if (texts.includes('true') && texts.includes('false')) {
        type = 'true-false';
      }
    }
    
    // Check for info block
    if (options.length === 0) {
      type = 'info';
    }

    questions.push({
      id: uuidv4(),
      type,
      text,
      options,
    });
  });

  return questions;
};
