goog.provide('htmleditor');

goog.addDependency('../../../htmlparser.js', ['htmlparser'], []);

goog.require('goog.events');
goog.require('goog.dom');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.editor.Field');
goog.require('goog.style');
goog.require('htmlparser');

/**
</ asfsaf >

htmleditor.index.sanitizeHtml = function(html) {

    function Parser() {
        var me = this;
        var nextState = Start;

        function Start(character) {
            if (character == '<') {
                nextState = PossibleTag; 
            } else {
                nextState = Start;
            }
        }

        function PossibleTag(character) {
            switch (character) {
                case '/':
                    nextState = possibleInvalidEndTag;
                    break;
                
            }
        }
    }

    var n = html.length;
    for (var i = 0; i < n; i++) {
        parser.process(html[i]);
    }
    return html;
};
 */

htmleditor.start = function(editorId, htmlId) {
    function onResize(evt) {
        var size = viewportMonitor.getSize();
        size.width = undefined;
        size.height -= 20;
        goog.style.setSize(goog.dom.getElement(editorId), size);
        goog.style.setSize(goog.dom.getElement(htmlId), size);
    }

    function updateHtml(evt) {
        var sanitized = htmlparser.sanitize(editor.getCleanContents(), {
            elements: ['style'],
            tags: ['font'],
            attributes: ['style']
        });
        goog.dom.getElement(htmlId).value = sanitized;
        //console.log(sanitized);
    }

    var viewportMonitor = new goog.dom.ViewportSizeMonitor();
    goog.events.listen(viewportMonitor, goog.events.EventType.RESIZE, onResize);
    
    var editor = new goog.editor.Field(editorId);
    goog.events.listen(editor, goog.editor.Field.EventType.DELAYEDCHANGE, updateHtml);
    editor.makeEditable();
    editor.focusAndPlaceCursorAtStart();
    onResize();
};
