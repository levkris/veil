const vscode = require('vscode');

const functionDocs = {
    print: 'print: prints to the console with no sanitization',
    printS: 'printS: prints to the console with sanitization',
    dump: 'dump: displays the value of an expression as formatted text on the page',
    appendToBody: 'appendToBody: appends HTML/text to the page body',
    let: 'let: declares a changable variable',
    const: 'const: declares a constant variable',
    if: 'if: executes a block if a condition is true',
    else: 'else: executes a block if a condition is false from the last if block',
    closebrace: 'closebrace: closes a block'
};

function activate(context) {
    const hoverProvider = vscode.languages.registerHoverProvider('veil', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            if (functionDocs[word]) {
                return new vscode.Hover(functionDocs[word]);
            }
        }
    });

    context.subscriptions.push(hoverProvider);
}

exports.activate = activate;
