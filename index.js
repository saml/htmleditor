goog.provide('htmleditor.index');

goog.require('goog.events');
goog.require('goog.dom');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.editor.Field');
goog.require('goog.style');

htmleditor.index.start = function(editorId, htmlId) {
    function onResize(evt) {
        var size = viewportMonitor.getSize();
        size.width = undefined;
        size.height -= 20;
        goog.style.setSize(goog.dom.getElement(editorId), size);
        goog.style.setSize(goog.dom.getElement(htmlId), size);
    }

    function updateHtml(evt) {
        goog.dom.getElement(htmlId).value = editor.getCleanContents();
    }

    var viewportMonitor = new goog.dom.ViewportSizeMonitor();
    goog.events.listen(viewportMonitor, goog.events.EventType.RESIZE, onResize);
    
    var editor = new goog.editor.Field(editorId);
    goog.events.listen(editor, goog.editor.Field.EventType.DELAYEDCHANGE, updateHtml);
    editor.makeEditable();
    editor.focusAndPlaceCursorAtStart();
    onResize();
};
