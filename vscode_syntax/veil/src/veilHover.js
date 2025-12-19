const vscode = require('vscode');

const veilDocs = {
    print: 'print(value): Prints to the console without sanitization.',
    printS: 'printS(value): Prints to the console with sanitization (safe for HTML).',
    dump: 'dump(value): Displays the value of an expression as formatted text on the page.',
    appendToBody: 'appendToBody(content): Appends HTML/text to the page body.',

    let: 'let variableName: type = value; Declares a mutable variable.',
    const: 'const variableName: type = value; Declares a constant variable.',
    if: 'if (condition) { ... } Executes the block if the condition is true.',
    elseif: 'elseif (condition) { ... } Executes the block if the previous if/elseif was false and this condition is true.',
    else: 'else { ... } Executes the block if all previous if/elseif conditions were false.',
    closebrace: 'closebrace: Closes a code block.',
    
    true: 'true: Boolean literal representing truth.',
    false: 'false: Boolean literal representing falsehood.',
    null: 'null: Represents an empty value.',
    int: 'int: Integer type.',
    string: 'string: String type.',
    bool: 'bool: Boolean type.',
    float: 'float: Floating-point number type.'
};

const reservedWords = new Set([
    'let', 'const', 'if', 'else', 'elseif',
    'true', 'false', 'null',
    'int', 'string', 'bool', 'float',
    'print', 'printS', 'dump', 'appendToBody'
]);

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
    const hoverProvider = vscode.languages.registerHoverProvider('veil', {
        provideHover(document, position) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return;
            const word = document.getText(range);

            if (veilDocs[word]) {
                return new vscode.Hover(veilDocs[word]);
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
