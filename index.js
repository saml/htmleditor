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
        size.height -= 10;
        goog.style.setSize(goog.dom.getElement(editorId), size);
        goog.style.setSize(goog.dom.getElement(htmlId), size);
    }

    var viewportMonitor = new goog.dom.ViewportSizeMonitor();
    goog.events.listen(viewportMonitor, goog.events.EventType.RESIZE, onResize);
    
    var editor = new goog.editor.Field(editorId);
    editor.makeEditable();
    editor.focusAndPlaceCursorAtStart();
    onResize();
};
