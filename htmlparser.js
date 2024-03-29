goog.provide('htmlparser');

function createParseContext(raw, options) {
	var index = 0;
	var context = {
		text: '',
		peek: function(count) {
			count = count || 1;
			return this.raw.substr(index + 1, count);
		},
		read: function(count) {
			if (count === 0) {
				return '';
			}
			count = count || 1;
			var next = this.peek(count);
			index += count;
			if (index > this.length) {
				index = this.length;
			}
			return next;
		},
		readUntilNonWhitespace: function() {
			var value = '', next;
			while (!this.isEof()) {
				next = this.read();
				value += next;
				if (!/\s$/.test(value)) {
					break;
				}
			}

			return value;
		},
		isEof: function() {
			return index >= this.length;
		},
		readRegex: function(regex) {
			var value = (regex.exec(this.raw.substring(this.index)) || [''])[0];
			index += value.length;
			return value;
		},
		peekIgnoreWhitespace: function(count) {
			count = count || 1;
			var value = '', next = '', offset = 0;
			do {
				next = this.raw.charAt(this.index + ++offset);
				if (!next) {
					break;
				}
				if (!/\s/.test(next)) {
					value += next;
				}
			} while (value.length < count);

			return value;
		}
	};

	context.__defineGetter__('current', function() {
		return this.isEof() ? '' : this.raw.charAt(this.index);
	});
	context.__defineGetter__('raw', function() {
		return raw;
	});
	context.__defineGetter__('length', function() {
		return this.raw.length;
	});
	context.__defineGetter__('index', function() {
		return index;
	});
	context.__defineGetter__('substring', function() {
		return this.raw.substring(this.index);
	});

	context.callbacks = {};
	var types = [ 'openElement', 'closeElement', 'attribute', 'comment', 'cdata', 'text', 'docType', 'xmlProlog', 'closeOpenedElement' ];
	types.forEach(function(value) {
		context.callbacks[value] = options[value] || function() {
		};
	});

	return context;
}

var nameRegex = /[a-zA-Z_][\w:-]*/;

function readAttribute(context) {
	var name = context.readRegex(nameRegex);
	var value = null;
	if (context.current === '=' || context.peekIgnoreWhitespace() === '=') {
		context.readRegex(/\s*=\s*/);
		var quote = /['"]/.test(context.current) ? context.current : '';
		var attributeValueRegex = !quote
			? /(.*?)(?=[\s>])/
			: new RegExp(quote + '(.*?)' + quote);

		var match = attributeValueRegex.exec(context.substring) || [0, ''];
		value = match[1];
		context.read(match[0].length);
	}

	context.callbacks.attribute(name, value);
}

function readAttributes(context, isXml) {
	function isClosingToken() {
		if (isXml) {
			return context.current === '?' && context.peek() === '>';
		}

		return context.current === '>' || (context.current === '/' && context.peekIgnoreWhitespace() === '>');
	}

	var next = context.current;
	while (!context.isEof() && !isClosingToken()) {
		if (nameRegex.test(next)) {
			readAttribute(context);
			next = context.current;
		}
		else {
			next = context.read();
		}
	}
}

function readCloserForOpenedElement(context, name) {
	var emptyElements = {
		'area': true, 'base': true, 'basefont': true, 'br': true, 'col': true, 'frame': true,
		'hr': true, 'img': true, 'input': true, 'isindex': true, 'link': true, 'meta': true,
		'param': true, 'embed': true
	};

	var isUnary = name in emptyElements;

	if (context.current === '/') {
		//self closing tag "/>"
		context.readUntilNonWhitespace();
		context.read();
		context.callbacks.closeOpenedElement(name, '/>', isUnary);
	}
	else if (context.current === '?') {
		//xml closing "?>"
		context.read(2);
		context.callbacks.closeOpenedElement(name, '?>', isUnary);
	}
	else {
		//normal closing ">"
		context.read();
		context.callbacks.closeOpenedElement(name, '>', isUnary);
	}
}

function parseOpenElement(context) {
	var name = context.readRegex(nameRegex);
	context.callbacks.openElement(name);
	readAttributes(context, false);
	readCloserForOpenedElement(context, name);

	if (!/^(script|xmp)$/i.test(name)) {
		return;
	}

	//just read until the closing tags for elements that allow cdata
	var regex = new RegExp('^([\\s\\S]*?)(?:$|</(' + name + ')\\s*>)', 'i');
	var match = regex.exec(context.substring);
	context.read(match[0].length);
	if (match[1]) {
		context.callbacks.cdata(match[1]);
	}
	if (match[2]) {
		context.callbacks.closeElement(match[2]);
	}
}

function parseEndElement(context) {
	var name = context.readRegex(nameRegex);
	context.callbacks.closeElement(name);
	context.readRegex(/.*?(?:>|$)/);
}

function parseCData(context) {
	//read "![CDATA["
	context.read(8);

	var match = /^([\s\S]*?)(?:$|]]>)/.exec(context.substring);
	var value = match[1];
	context.read(match[0].length);
	context.callbacks.cdata(value);
}

function parseComment(context) {
	//read "!--"
	context.read(3);

	var match = /^([\s\S]*?)(?:$|-->)/.exec(context.substring);
	var value = match[1];
	context.read(match[0].length);
	context.callbacks.comment(value);
}

function parseDocType(context) {
	//read "!doctype"
	context.read(8);

	var match = /^\s*([\s\S]*?)(?:$|>)/.exec(context.substring);
	var value = match[1];
	context.read(match[0].length);
	context.callbacks.docType(value);
}

function parseXmlProlog(context) {
	//read "?xml"
	context.read(4);
	context.callbacks.xmlProlog();
	readAttributes(context, true);
	readCloserForOpenedElement(context, '?xml');
}

function appendText(value, context) {
	context.text += value;
}

function callbackText(context) {
	if (context.text) {
		context.callbacks.text(context.text);
		context.text = '';
	}
}

function parseNext(context) {
	var current = context.current, buffer = current;
	if (current == '<') {
		buffer += context.read();
		if (context.current === '/') {
			buffer += context.read();
			if (nameRegex.test(context.current)) {
				callbackText(context);
				parseEndElement(context);
			} else {
				//malformed html
				context.read();
				appendText(buffer, context);
			}
		} else if (context.current === '!') {
			if (/^!\[CDATA\[/.test(context.substring)) {
				callbackText(context);
				parseCData(context);
			} else if (/^!--/.test(context.substring)) {
				callbackText(context);
				parseComment(context);
			} else if (/^!doctype/i.test(context.substring)) {
				callbackText(context);
				parseDocType(context);
			} else {
				//malformed html
				context.read();
				appendText(buffer, context);
			}
		} else if (context.current === '?') {
			if (/^\?xml/.test(context.substring)) {
				callbackText(context);
				parseXmlProlog(context);
			} else {
				//malformed xml prolog
				context.read();
				appendText(buffer, context);
			}
		} else if (nameRegex.test(context.current)) {
			callbackText(context);
			parseOpenElement(context);
		} else {
			//malformed html
			context.read();
			appendText(buffer, context);
		}
	} else {
		appendText(context.current, context);
		context.read();
	}
}

/**
 * Parses the given string o' HTML, executing each callback when it
 * encounters a token.
 *
 * @param {String} htmlString A string o' HTML
 * @param {Object} [callbacks] Callbacks for each token
 * @param {Function} [callbacks.attribute] Takes the name of the attribute and its value
 * @param {Function} [callbacks.openElement] Takes the tag name of the element
 * @param {Function} [callbacks.closeOpenedElement] Takes the tag name of the element, the token used to
 * close it (">", "/>", "?>") and a boolean telling if it is unary or not (i.e., if it doesn't requires
 * another tag closing it later)
 * @param {Function} [callbacks.closeElement] Takes the name of the element
 * @param {Function} [callbacks.comment] Takes the content of the comment
 * @param {Function} [callbacks.docType] Takes the content of the document type declaration
 * @param {Function} [callbacks.cdata] Takes the content of the CDATA
 * @param {Function} [callbacks.xmlProlog] Takes no arguments
 * @param {Function} [callbacks.text] Takes the value of the text node
 */
htmlparser.parse = function(htmlString, callbacks) {
	htmlString = htmlString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	var context = createParseContext(htmlString, callbacks);
	do {
		parseNext(context);
	} while (!context.isEof());

	callbackText(context);
};


/**
 * Sanitizes an HTML string.
 *
 * If removalCallbacks is not given, it will simply reformat the HTML
 * (i.e. converting all tags to lowercase, etc.). Note that this function
 * assumes that the HTML is decently formatted and kind of valid. It
 * may exhibit undefined or unexpected behavior if your HTML is trash.
 *
 * @param {String} htmlString A string o' HTML
 * @param {Object} [removalCallbacks] Callbacks for each token type
 * @param {Function|Array} [removalCallbacks.attributes] Callback or array of specific attributes to strip
 * @param {Function|Array} [removalCallbacks.elements] Callback or array of specific elements to strip
 * @param {Function|Boolean} [removalCallbacks.comments] Callback or boolean indicating to strip comments
 * @param {Function|Boolean} [removalCallbacks.docTypes] Callback or boolean indicating to strip doc type declarations
 * @return {String} The sanitized HTML
 */
htmlparser.sanitize = function(htmlString, removalCallbacks) {
	removalCallbacks = removalCallbacks || {};

	function createArrayCallback(index) {
		var callbackOrArray = removalCallbacks[index] || [];
		if (typeof(callbackOrArray) === 'function') {
			return function() {
				return callbackOrArray.apply(null, arguments);
			}
		} else {
			return function(value) {
				return callbackOrArray.indexOf(value) !== -1;
			}
		}
	}

	function createBoolCallback(index) {
		var callbackOrBool = removalCallbacks[index] || false;
		if (typeof(callbackOrBool) === 'function') {
			return function() {
				return callbackOrBool.apply(null, arguments);
			}
		} else {
			return function() {
				return callbackOrBool;
			}
		}
	}

	function last(arr) {
		return arr[arr.length - 1];
	}

	var toRemove = {
		attributes: createArrayCallback('attributes'),
		elements: createArrayCallback('elements'),
		comments: createBoolCallback('comments'),
		docTypes: createBoolCallback('docTypes')
	};

	var sanitized = '', tagStack = [];
	var ignoreStack = [];
	var selfClosingTags = {
		meta: 1,
		br: 1,
		link: 1,
		area: 1,
		base: 1,
		col: 1,
		command: 1,
		embed: 1,
		hr: 1,
		img: 1,
		input: 1,
		param: 1,
		source: 1
	};
	var callbacks = {
		docType: function(value) {
			if (toRemove.docTypes(value)) {
				return;
			}
			sanitized += '<!doctype ' + value + '>';
		},

		openElement: function(name) {
			name = name.toLowerCase();
			//if there is an unclosed self-closing tag in the stack, then
			//pop it off (assumed to be malformed html).
			if (tagStack.length) {
				var scope = last(tagStack);
				if (selfClosingTags[scope]) {
					tagStack.pop();
					if (scope === last(ignoreStack)) {
						ignoreStack.pop();
					}
				}
			}

			if (ignoreStack.length) {
				return;
			}

			tagStack.push(name);
			if (toRemove.elements(name)) {
				ignoreStack.push(name);
				return;
			}
			sanitized += '<' + name;
		},

		closeOpenedElement: function(name, token) {
			name = name.toLowerCase();
			if (token.length === 2) {
				//self closing
				var scope = tagStack.pop();
				if (scope === last(ignoreStack)) {
					ignoreStack.pop();
				}
			}
			if (ignoreStack.length || toRemove.elements(name)) {
				return;
			}
			sanitized += token;
		},

		closeElement: function(name) {
			name = name.toLowerCase();
			if (tagStack.length && last(tagStack) === name) {
				if (tagStack.pop() === last(ignoreStack)) {
					ignoreStack.pop();
				}
			}
			if (ignoreStack.length || toRemove.elements(name)) {
				return;
			}
			sanitized += '</' + name + '>';
		},

		attribute: function(name, value) {
			if (ignoreStack.length) {
				return;
			}

			name = name.toLowerCase();
			if (toRemove.attributes(name, value)) {
				return;
			}

			sanitized += ' ' + name;
			if (value) {
				sanitized += '="' + value.replace(/"/g, '&quot;') + '"';
			}
		},

		text: function(value) {
			if (ignoreStack.length) {
				return;
			}
			sanitized += value;
		},

		comment: function(value) {
			if (ignoreStack.length || toRemove.comments(value)) {
				return;
			}
			sanitized += '<!--' + value + '-->';
		},

		cdata: function(value) {
			if (ignoreStack.length) {
				return;
			}

			for (var i = tagStack.length - 1; i >= 0; i--) {
				if (tagStack[i] === 'script' || tagStack[i] === 'xmp') {
					sanitized += value;
					return;
				}
			}

			sanitized += '<![CDATA[' + value + ']]>';
		}
	};

	htmlparser.parse(htmlString, callbacks);
	return sanitized;
};

