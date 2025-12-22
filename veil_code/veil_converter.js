// VEIL Language Interpreter
// Main interpreter with modular function loading

let veilFunctions = {}

async function loadVeilFunctions(){
    try {
        let manifestResponse = await fetch('./veil_code/functions/manifest.json')
        if(!manifestResponse.ok) throw new Error('Failed to load manifest.json')
        let manifest = await manifestResponse.json()

        for(let funcDef of manifest.functions){
            let funcResponse = await fetch(`./veil_code/functions/${funcDef.file}`)
            if(!funcResponse.ok){
                console.warn(`Failed to load ${funcDef.file}`)
                continue
            }
            let funcCode = await funcResponse.text()

            let triggerEscaped = funcDef.trigger.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1')
            triggerEscaped = triggerEscaped.replace(/\s+/g, '\\s*')

            let triggerRegex = new RegExp('(.*?)\\s*' + triggerEscaped + '\\s*(.*)')

            veilFunctions[funcDef.trigger] = {
                ...parseFunctionFile(funcCode, funcDef.trigger),
                regex: triggerRegex,
                rawTrigger: funcDef.trigger
            }
        }
        console.log('VEIL functions loaded:', Object.keys(veilFunctions))
    } catch(e){
        console.error('Error loading VEIL functions:', e)
    }
}

function parseFunctionFile(code, trigger){
    let lines = code.split('\n')
    let metadata = {}
    let handlerCode = []
    let inHandler = false

    for(let line of lines){
        if(line.startsWith('// NAME:')){
            metadata.name = line.replace('// NAME:', '').trim()
        } else if(line.startsWith('// DESCRIPTION:')){
            metadata.description = line.replace('// DESCRIPTION:', '').trim()
        } else if(line.startsWith('// TRIGGER:')){
            metadata.trigger = line.replace('// TRIGGER:', '').trim()
        } else if(line.startsWith('// HANDLER')){
            inHandler = true
        } else if(inHandler){
            handlerCode.push(line)
        }
    }

    let functionBody = handlerCode.join('\n')
    let handler = new Function('line', 'variables', 'evaluateExpression', 'sanitize', 'beforeTrigger', 'afterTrigger', functionBody)

    return { metadata, handler }
}

async function loadVeilScript(src){
    try {
        let response = await fetch(src)
        if(!response.ok) throw new Error(`Failed to load ${src}`)
        let code = await response.text()
        runVeil(code)
    } catch(e){
        console.error(e)
    }
}

function sanitize(val){
    if(typeof val === "string") {
        return val.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    }
    return val
}

function evaluateExpression(expr, variables){
    expr = expr.trim()

    let declMatch = expr.match(/^(let|const)\s+(\w+)(\s*:\s*\w+)?\s*=\s*(.+);?$/)
    if(declMatch){
        let [, , varName, , valueExpr] = declMatch
        let value = evaluateExpression(valueExpr, variables)
        variables[varName] = value
        return value
    }

    let isDeclaration = false
    if(expr.includes(':')){
        let parts = expr.split('=')
        if(parts.length === 2){
            let leftSide = parts[0].trim()
            if(leftSide.includes(':')){
                leftSide = leftSide.split(':')[0].trim()
                expr = leftSide + '=' + parts[1]
                isDeclaration = true
            }
        }
    }

    if(expr.startsWith('`') && expr.endsWith('`')){
        let template = expr.slice(1, -1)
        
        template = template.replace(/\$\{(\w+)\}/g, (match, varName) => {
            return variables[varName] !== undefined ? variables[varName] : match
        })
        
        return template
    }

    let parts = []
    let current = ''
    let inString = false
    let stringChar = null
    let inTemplate = false

    for(let i = 0; i < expr.length; i++){
        let char = expr[i]

        if(!inString && !inTemplate && (char === '"' || char === "'" || char === '`')){
            if(current) parts.push({type: 'code', value: current})
            current = char
            inString = char !== '`'
            inTemplate = char === '`'
            stringChar = char
        } else if(inString && char === stringChar && expr[i-1] !== '\\'){
            current += char
            parts.push({type: 'string', value: current})
            current = ''
            inString = false
            stringChar = null
        } else if(inTemplate && char === '`' && expr[i-1] !== '\\'){
            current += char
            parts.push({type: 'template', value: current})
            current = ''
            inTemplate = false
            stringChar = null
        } else {
            current += char
        }
    }

    if(current) parts.push({type: inString || inTemplate ? 'string' : 'code', value: current})

    let result = ''
    for(let part of parts){
        if(part.type === 'code'){
            let code = part.value

            if(isDeclaration){
                let varMatch = code.match(/^(\w+)\s*=/)
                let declaringVar = varMatch ? varMatch[1] : null

                for(let v in variables){
                    if(v.startsWith('__')) continue
                    if(v === declaringVar) continue
                    let regex = new RegExp('\\b' + v + '\\b', 'g')
                    code = code.replace(regex, JSON.stringify(variables[v]))
                }
            } else {
                for(let v in variables){
                    if(v.startsWith('__')) continue
                    let regex = new RegExp('\\b' + v + '\\b', 'g')
                    code = code.replace(regex, JSON.stringify(variables[v]))
                }
            }
            result += code
        } else if(part.type === 'template'){
            let template = part.value.slice(1, -1)
            
            template = template.replace(/\$\{(\w+)\}/g, (match, varName) => {
                return variables[varName] !== undefined ? variables[varName] : match
            })
            
            result += JSON.stringify(template)
        } else {
            result += part.value
        }
    }

    try {
        if(result.endsWith(';')) result = result.slice(0, -1)
        return Function('"use strict";return (' + result + ')')()
    } catch(e){
        console.error("Invalid expression:", result)
        return undefined
    }
}

function executeLine(line, variables){
    let trimmed = line.trim()
    let isControlFlow = /^if\s*\(|^else|^}/.test(trimmed)
    let isBlockStart = /{$/.test(trimmed)
    let isBlockEnd = /^}/.test(trimmed)

    if(variables.__skipExecution && !isControlFlow) return

    if(!variables.__blockStack) variables.__blockStack = []

    if(/^if\s*\(/.test(trimmed)){
        variables.__blockStack.push({type: 'if', skip: variables.__skipExecution})
    } else if(/^}\s*elseif\s*\(/.test(trimmed) || /^}\s*else\s*\{/.test(trimmed)){
        let last = variables.__ifStack[variables.__ifStack.length - 1]
        let wasExecuted = last.results.includes(true)
        variables.__skipExecution = wasExecuted
    } else if(isBlockEnd){
        let lastBlock = variables.__blockStack.pop()
        if(lastBlock) variables.__skipExecution = lastBlock.skip
    }

    let matched = false
    for(let trigger in veilFunctions){
        let {handler, rawTrigger} = veilFunctions[trigger]
        
        if(rawTrigger === '}' || rawTrigger === '} else {' || rawTrigger === '} elseif ('){
            if(trimmed.startsWith(rawTrigger)){
                try {
                    handler(line, variables, evaluateExpression, sanitize)
                    matched = true
                    break
                } catch(e){
                    console.error(`Error executing ${trigger}:`, e)
                }
            }
        } else if(line.includes(rawTrigger)){
            try {
                handler(line, variables, evaluateExpression, sanitize)
                matched = true
                break
            } catch(e){
                console.error(`Error executing ${trigger}:`, e)
            }
        }
    }
    
    if(!matched && trimmed && !trimmed.startsWith('//') && !isBlockStart && !isBlockEnd){
        if(!trimmed.endsWith(';')){
            console.warn('Line missing semicolon:', line)
        } else {
            evaluateExpression(trimmed.slice(0, -1), variables)
        }
    }
}

function runVeil(code){
    let lines = code.split("\n")
    let variables = {}
    variables.__varTypes = {}

    let i = 0
    while(i < lines.length){
        let line = lines[i]
        if(!line.trim() || line.trim().startsWith('//')){
            i++
            continue
        }

        let trimmedLine = line.trim()
        if(trimmedLine.includes('`')){
            let fullLine = ''
            let inTemplate = false

            for(; i < lines.length; i++){
                let currentLine = lines[i]
                fullLine += currentLine + '\n'

                let backtickMatches = currentLine.match(/(^|[^\\])`/g)
                let count = backtickMatches ? backtickMatches.length : 0
                if(count % 2 === 1) inTemplate = !inTemplate

                if(!inTemplate) break
            }

            executeLine(fullLine.trim(), variables)
            i++
            continue
        }

        executeLine(line.trim(), variables)
        i++
    }
}


document.addEventListener("DOMContentLoaded", async ()=>{
    await loadVeilFunctions()
    
    document.querySelectorAll('script[type="text/veil"]').forEach(script=>{
        let src = script.getAttribute('src')
        if(src) loadVeilScript(src)
    })
})