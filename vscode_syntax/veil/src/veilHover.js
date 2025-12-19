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
    closebrace: 'closebrace: Closes a code block.'
};

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
            if (variablePattern.test(word)) {
                return new vscode.Hover(`Variable \`${word}\`: Refers to a user-defined variable. Can be declared with let/const or reassigned later.`);
            }
        }
    });

    context.subscriptions.push(hoverProvider);
}

exports.activate = activate;
