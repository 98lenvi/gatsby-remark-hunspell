const visit = require(`unist-util-visit`)
const fs = require('fs').promises
const path = require('path');
const { Nodehun } = require('nodehun')


function patch(context, key, value) {
    if (!context[key]) {
        context[key] = value
    }

    return context[key]
}

module.exports = async (
    { markdownAST }
) => {

    /**
     * Not added types like 'utf-8' on purpose
     * Nodehun expects dictionary & affix in buffer format
     */
    const aff = await fs.readFile(path.join(__dirname, 'aff.aff'))
    const dic = await fs.readFile(path.join(__dirname, 'dic.dic'))
    
    
    /**
     * Initializing nodehun - Node.js wrapper for Hunspell
     */
    const nodehun = new Nodehun(aff, dic)

    /**
     * Traversing markdownAST tree using unist
     */
    visit(markdownAST, node => {

        /**
         * Only checking for these types
         */
        if (node.type === 'paragraph' || node.type === 'list' || node.type === 'heading' || node.type === 'blockquote') {
            let suggestionsArray = []
            node.children.map(
                async childNode => {
                    if (childNode.type === 'text') {
                        /**
                         * TO DO 
                         * add optimization to avoid segmentation issues, probably check nodehun's implementation
                         */
                        /**
                         * removing special characters because Hunspell reports "word," as a spelling mistake (with suggestion given as "word")
                         */
                        let onlyStringChildNode = childNode.value.replace(/[^\w\s]/gi, ' ')
                        /**
                         * Splitting text into Array, with space as delimiter 
                         */
                        onlyStringChildNode.split(" ").map(word => {
                            /**
                             * TO DO
                             * Need to replace with async version
                             */
                            /**
                             * Getting suggestions for the word, if there are mistakes
                             * an Array is returned, else null is returned
                             */
                            const hunspellSuggestion = nodehun.suggestSync(word)
                            if (hunspellSuggestion !== null) {
                                /**
                                 * Populating array if there is a spelling mistake
                                 */
                                suggestionsArray.push({ original: word, suggestion: hunspellSuggestion })
                            }
                        }
                        )
                    }
                }
            )
            /**
             * If there is a reported spelling mistake in the paragraph
             */
            if (suggestionsArray.length > 0) {

                /**
                 * Extending unist markdown tree
                 */

                const data = patch(node, `data`, {})
                patch(data, `htmlAttributes`, {})
                patch(data, `hProperties`, {})
                /**
                 * Above 3 lines are useless but I'm scared to remove them
                 */

                /**
                 * Generating HTML that contains reported spelling mistakes with suggested corrections
                 */
                suggestionHTMLString = `<aside class='gatsby-remark-hunspell-container'>`
                suggestionsArray.map(mistake => {
                    suggestionHTMLString = suggestionHTMLString + `<div class='gatsby-remark-hunspell-item'><span class='gatsby-remark-hunspell-original'>${mistake.original}</span>${mistake.suggestion ? `<span class='gatsby-remark-hunspell-correction'>${mistake.suggestion}</span>` : `<span class='gatsby-remark-hunspell-correction-none'>No corrections found</span>`}</div>`
                })
                suggestionHTMLString = suggestionHTMLString + `</aside>`

                /**
                 * Pushing into unist tree
                 */
                node.children.push({
                    type: `html`,
                    value: suggestionHTMLString,
                })
            }
        }
    })
    return markdownAST



}