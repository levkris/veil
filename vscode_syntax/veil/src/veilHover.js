const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function loadFunctionDocs() {
	const docPath = path.join(__dirname, 'function_docs.json');
	const raw = fs.readFileSync(docPath, 'utf8');
	const json = JSON.parse(raw);

	const docs = {};
	const reservedWords = new Set();

	json.forEach(fn => {
		docs[fn.trigger] = fn;
		reservedWords.add(fn.trigger);
	});

	return { docs, reservedWords };
}

function isInsideCommentOrString(document, position) {
	const lineText = document.lineAt(position.line).text;
	const index = position.character;

	const commentIndex = lineText.indexOf('//');
	if (commentIndex !== -1 && index >= commentIndex) return true;

	const doubleQuotesBefore = (lineText.slice(0, index).match(/"/g) || []).length;
	if (doubleQuotesBefore % 2 === 1) return true;

	const singleQuotesBefore = (lineText.slice(0, index).match(/'/g) || []).length;
	if (singleQuotesBefore % 2 === 1) return true;

	const backticksBefore = (lineText.slice(0, index).match(/`/g) || []).length;
	if (backticksBefore % 2 === 1) return true;

	return false;
}

function activate(context) {
	const { docs: functionDocs, reservedWords } = loadFunctionDocs();

	const hoverProvider = vscode.languages.registerHoverProvider('veil', {
		provideHover(document, position) {
			const range = document.getWordRangeAtPosition(position);
			if (!range) return;
			const word = document.getText(range);

			if (functionDocs[word]) {
				const fn = functionDocs[word];
				const hoverText = fn.hover || '';
				const deprecatedText = fn.deprecated ? `\n\n⚠ Deprecated${fn.deprecated_version ? ` since version ${fn.deprecated_version}` : ''}` : '';

				const markdown = new vscode.MarkdownString();
				markdown.appendMarkdown(`${hoverText}${deprecatedText}\n\n`);

				markdown.appendMarkdown(`<details>\n<summary>More info</summary>\n\n`);
				markdown.appendMarkdown(`**${fn.name} - ${fn.description || ''}**  \n`);
				markdown.appendMarkdown(`| Implemented By | Implemented In Version |\n|---|---|\n| ${fn.implemented_by} | ${fn.implemented_version} |\n`);
				markdown.appendMarkdown(`</details>`);

				markdown.isTrusted = true;
				return new vscode.Hover(markdown);
			}

			const variablePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
			if (variablePattern.test(word) && !reservedWords.has(word)) {
				if (!isInsideCommentOrString(document, position)) {
					return new vscode.Hover(`Variable \`${word}\`: Refers to a user-defined variable. Can be declared with let/const or reassigned later.`);
				}
			}
		}
	});

	context.subscriptions.push(hoverProvider);
}

exports.activate = activate;
