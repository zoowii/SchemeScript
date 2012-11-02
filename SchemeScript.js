var context = exports;  // if in browser, use window, else if in node.js, use exports
(function (context) {
    "use strict";

    var ss = {}; // this closure
    var _ = {
        has:function (obj, key) {
            return Object.prototype.hasOwnProperty.call(obj, key);
        },
        each:function (obj, iterator, context) {
            if (obj.forEach === Array.prototype.forEach()) {
                obj.forEach(iterator, context);
            } else if (obj.length === +obj.length) {
                for (var i = 0, l = obj.length; i < l; i++) {
                    if (iterator.call(context, obj[i], i, obj) === {}) return;
                }
            } else {
                for (var key in obj) {
                    if (this.has(obj, key)) {
                        if (iterator.call(context, obj[key], key, obj) === {}) return;
                    }
                }
            }
        },
        any:function (obj, iterator, context) {
            var result = false;
            if (obj.some === Array.prototype.some) return obj.some(iterator, context);
            this.each(obj, function (value, index, list) {
                if (result || (result = iterator.call(context, value, index, list))) return {};
            });
            return !!result;
        },
        contains:function (obj, target) {
            var found = false;
            if (obj.indexOf === Array.prototype.indexOf) return obj.indexOf(target) != -1;
            found = this.any(obj, function (value) {
                return value === target;
            });
            return found;
        },
        sizeOfObj:function (obj) {
            var len = 0;
            for (var k in obj) {
                len += 1;
            }
            return len;
        }
    }; // helper functions in this object


    function output(item) {
        ss.outputHandler(item);
    }

    var TokenType = {
        SPECIAL_SYMBOL:'SPECIAL_SYMBOL',
        NUM:'NUM',
        ID:'ID',
        COMMENT:'COMMENT',
        FORM_START:'FORM_START',
        FORM_END:'FORM_END',

        STRING:'STRING',
        BOOLEAN:'BOOLEAN',

        // 以下不被词法分析阶段使用
        ORIGINAL_FUNC:'ORIGINAL_FUNC',
        SS_FUNCTOR:'SS_FUNCTOR',
        NULL:'NULL',
        LIST:'LIST',
        PAIR:'PAIR'
    };

    var SFormItem = function (str, type) {
        this.value = str;
        this.type = type;
        if (this.type === TokenType.NUM) {
            this.numVal = eval(str);
        } else if (this.type === TokenType.BOOLEAN) {
            this.boolVal = eval(str);
        } else if (this.type === TokenType.SS_FUNCTOR) {
            this.funcParamNames = this.value.paramNames;
            this.funcBoundParams = this.value.boundParamNames;
            this.funcBody = this.value.body;
        } else if (this.type === TokenType.LIST) {
            this.length = this.value.length;
            this.get = function (n) {
                return this.value[n];
            };
        }
        this.display = function () {
            return "value:\t" + this.value + "\t" + this.type;
        };
        this.toString = function () {
            if (this.type === TokenType.LIST) {
                var str = '[';
                for (var i = 0; i < this.value.length; i++) {
                    if (i !== 0) {
                        str += ',';
                    }
                    if (this.value[i] instanceof SFormItem) {
                        str += this.value[i].toString();
                    } else {
                        throwError('only can store SFormItem in list');
                    }
                }
                str += ']';
                return str;
            } else if (this.type === TokenType.SS_FUNCTOR) {
                var boundSize = _.sizeOfObj(this.funcBoundParams);
                if (boundSize === 0) {
                    return '[Function(' + this.funcParamNames.length + ')]';
                } else {
                    return '[Function(' + boundSize + ')(' + this.funcParamNames.length + ')]';
                }
            } else {
                return this.value + '';
            }
        };
    };
    var SForm = function () {
        this.items = [];
        this.push = function (item) {
            this.items.push(item);
        };
        this.unshift = function (item) {
            this.items.unshift(item);
        };
        this.pop = function () {
            return this.items.pop();
        };
        this.display = function () {
            var str = 'form[\n';
            for (var i = 0; i < this.items.length; i++) {
                str += this.items[i].display();
                str += '\n';
            }
            str += ']end form\n';
            return str;
        };
        this.size = function () {
            return this.items.length;
        };
        this.get = function (index) {
            return this.items[index];
        };
        this.hasNested = function () {
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i] instanceof SForm) {
                    return true;
                }
            }
            return false;
        };
        this.removeComments = function () {
            var newItems = [];
            for (var i = 0; i < this.items.length; i++) {
                if (!(this.items[i] instanceof SFormItem) || (this.items[i].type !== TokenType.COMMENT)) {
                    newItems.push(this.items[i]);
                }
            }
            this.items = newItems;
        };
    };

    var SFormList = function () {
        this.forms = [];
        this.push = function (form) {
            this.forms.push(form);
        };
        this.unshift = function (form) {
            this.forms.unshift(form);
        };
        this.pop = function () {
            return this.forms.pop();
        };
        this.display = function () {
            var str = 'forms[\n';
            for (var i = 0; i < this.forms.length; i++) {
                str += this.forms[i].display();
                str += '\n';
            }
            str += ']end forms\n';
            return str;
        };
        this.size = function () {
            return this.forms.length;
        };
        this.get = function (index) {
            return this.forms[index];
        };
        this.removeComments = function () {
            for (var i = 0; i < this.forms.length; i++) {
                if (this.forms[i] instanceof SForm) {
                    this.forms[i].removeComments();
                }
            }
        };
    };

    var StrStream = function (source) { // 字符流类
        this.source = source + ' '; // 使得最后至少有一个空白符
        this.cur = 0;
        this.size = this.source.length; // count of rest chars
        this.shift = function () {
            if (this.cur >= this.source.length) {
                return null;
            }
            this.size -= 1;
            var c = this.source[this.cur];
            this.cur += 1;
            return c;
        };
        this.unShift = function () {
            if (this.cur <= 0) {
                return false;
            }
            this.size += 1;
            this.cur -= 1;
            return true;
        };
        this.hasNext = function () {
            return this.cur < this.source.length;
        };
        this.nextCharWithoutAdvance = function () {
            if (this.cur >= this.source.length) {
                return null;
            }
            return this.source[this.cur];
        };
        this.remainingSize = function () {
            return this.size;
        };
    };

    function lexAnalise(str) {
        // 开始词法分析

        var isInAlphabet = function (c) {
            if (_.contains(['+', '-', '*', '/', '?', '!', '=', '$', '<', '>', '%', '&', '|', '_', '(', ')', '{', '}', ';', ':'], c)) {
                return true;
            }
            var rCharOrDigit = /^\w$/g;
            return rCharOrDigit.test(c);
        };
        var isIdChar = function (c) {
            return isInAlphabet(c) && !isSpecialChar(c) && !isWhiteSpace(c) && !isCommentChar(c);
        };
        var isIdStartChar = function (c) {
            return isInAlphabet(c) && !isSpecialChar(c) && !isWhiteSpace(c) && !isCommentChar(c) && !isDigit(c);
        };
        var isSpecialChar = function (c) {
            return c === '(' || c === ')' || c === ';';
        };
        var isFormChar = function (c) {
            return c === '(' || c === ')';
        };
        var isWhiteSpace = function (c) {
            return c === ' ' || c === '\t' || c === '\n' || c === ',';
        };
        var isCommentChar = function (c) {
            return c === ';';
        };
        var isDigit = function (c) {
            return /^\d$/g.test(c);
        };
        var isNum = function (str) {
            var rNum = /^-?\d+(\.\d+)?$/g;
            return rNum.test(str);
        };
        var isLambdaChar = function (c) {
            return c === '#';
        };

        var stream = new StrStream(str);
        var State = {  // 词法分析中的状态
            START:'START',
            IN_FORM:'IN_FORM',
            IN_ID:'IN_ID',
            IN_NUM:'IN_NUM',
            IN_COMMENT:'IN_COMMENT',
            IN_STRING:'IN_STRING',
            DONE_FORM:'DONE_FORM',
            DONE_ID:'DONE_ID',
            DONE_NUM:'DONE_NUM',
            DONE_COMMENT:'DONE_COMMENT',
            DONE_STRING:'DONE_STRING',
            ERROR:'ERROR'
        };
        var saved_state = State.START;
        var state = State.START;
        var forms = new SFormList();
        var cur_form = new SForm();
        var cur_item_str = '';
        var nested_form_count = 0; // 处在第几层form(包含嵌套)

        stream_loop:
            while (stream.hasNext()) {
                var c = stream.shift();
                switch (state) {
                    case State.START:
                    {
                        if (isWhiteSpace(c)) {
                            // do nothing
                        } else if (c === '(') {
                            state = State.IN_FORM;
                            nested_form_count += 1;
                            cur_form.push(new SFormItem(c, TokenType.FORM_START));
                        } else if (c === ';') {
                            saved_state = state;
                            state = State.IN_COMMENT;
                        } else {
                            saved_state = state;
                            state = State.ERROR;
                            stream.unShift();
                        }
                    }
                        break;
                    case
                    State.IN_FORM
                    :
                    {
                        if (isCommentChar(c)) {
                            saved_state = state;
                            state = State.IN_COMMENT;
                        } else if (isIdStartChar(c)) {
                            state = State.IN_ID;
                            cur_item_str += c;
                        } else if (isDigit(c)) {
                            state = State.IN_NUM;
                            cur_item_str += c;
                        } else if (isWhiteSpace(c)) {
                            // do nothing
                        } else if (c === ')') {
                            state = State.DONE_FORM;
                            cur_form.push(new SFormItem(c, TokenType.FORM_END));
                        } else if (c === '(') { // nested form
                            cur_form.push(new SFormItem(c, TokenType.FORM_START));
                            nested_form_count += 1;
                        } else if (c === '"') {
                            state = State.IN_STRING;
                        } else {
                            throwError(c);
                            saved_state = state;
                            state = State.ERROR;
                            stream.unShift();
                        }
                    }
                        break;
                    case
                    State.IN_ID
                    :
                    {
                        if (isIdChar(c)) {
                            cur_item_str += c;
                        } else if (isWhiteSpace(c)) {
                            state = State.DONE_ID;
                        } else if (isFormChar(c)) {
                            state = State.DONE_ID;
                            stream.unShift();
                        } else {
                            saved_state = state;
                            state = State.ERROR;
                            stream.unShift();
                        }
                    }
                        break;
                    case
                    State.IN_NUM
                    :
                    {
                        if (isWhiteSpace(c)) {
                            state = State.DONE_NUM;
                        } else if (isDigit(c)) {
                            cur_item_str += c;
                        } else if (isFormChar(c)) {
                            state = State.DONE_NUM;
                            stream.unShift();
                        } else {
                            saved_state = state;
                            state = State.ERROR;
                            stream.unShift();
                        }
                    }
                        break;
                    case
                    State.IN_COMMENT
                    :
                    {
                        if (c === '\n') {
                            state = State.DONE_COMMENT;
                        } else {
                            cur_item_str += c;
                        }
                    }
                        break;
                    case
                    State.IN_STRING:
                    {
                        if (c === '"') {
                            state = State.DONE_STRING;
                        } else {
                            cur_item_str += c;
                        }
                    }
                        break;
                    case
                    State.DONE_FORM
                    :
                    {
                        stream.unShift();
                        if (nested_form_count < 1) {
                            saved_state = state;
                            state = State.ERROR;
                        } else if (nested_form_count === 1) {
                            forms.push(cur_form);
                            cur_form = new SForm();
                            state = State.START;
                            nested_form_count = 0;
                        } else {
                            var tmpForm = new SForm();
                            while (cur_form.size() > 0) {
                                var tmpItem = cur_form.pop();
                                tmpForm.unshift(tmpItem);
                                if (tmpItem.type === TokenType.FORM_START) {
                                    break;
                                }
                            }
                            cur_form.push(tmpForm);
                            nested_form_count -= 1;
                            // 检测左括号比配剩余情况
                            var left_bracket_count = 0;
                            for (var i = 0; i < cur_form.size(); i++) {
                                if (cur_form.get(i) instanceof SFormItem && cur_form.get(i).type === TokenType.FORM_START) {
                                    left_bracket_count += 1;
                                }
                            }
                            if (nested_form_count != left_bracket_count) {
                                state = State.ERROR;
                                throwError('括号不匹配');
                            }
                            state = State.IN_FORM;
                        }
                    }
                        break;
                    case
                    State.DONE_ID
                    :
                    {
                        stream.unShift();
                        cur_form.push(new SFormItem(cur_item_str, TokenType.ID));
                        cur_item_str = '';
                        state = State.IN_FORM;
                    }
                        break;
                    case
                    State.DONE_NUM
                    :
                    {
                        stream.unShift();
                        cur_form.push(new SFormItem(cur_item_str, TokenType.NUM));
                        cur_item_str = '';
                        state = State.IN_FORM;
                    }
                        break;
                    case
                    State.DONE_COMMENT
                    :
                    {
                        stream.unShift();
                        cur_form.push(new SFormItem(cur_item_str, TokenType.COMMENT));
                        cur_item_str = '';
                        state = saved_state;
                        saved_state = State.START;
                    }
                        break;
                    case State.DONE_STRING:
                    {
                        stream.unShift();
                        cur_form.push(new SFormItem(cur_item_str, TokenType.STRING));
                        cur_item_str = '';
                        state = State.IN_FORM;
                    }
                        break;
                    case
                    State.ERROR
                    :
                    {
                        throwError('analise the program error\n' + 'last state is ' + saved_state);
                        break stream_loop;
                    }
                        break;
                    default:
                    {
                        throwError('unknown state');
                        break stream_loop;
                    }
                }
            }

        // 词法分析到此结束
        return forms;
    }

    var throwError = function (msg) {
        ss.errorHandler(msg);
    };

    var EnvItem = function (name, value) {
        this.name = name;
        this.value = value;
    };

    var EnvTree = function () {
        this.curEnv = new DefaultRootEnv();
        this.getIdentifierValue = function (id) {
            var item = this.curEnv.findIdentifier(id);
            if (item === null) {
                throwError('undefine identifier ' + id);
            } else {
                return item;
            }
        };
    };

    var envTree = new EnvTree();

    function Env(parentEnv) {
        this.parent = parentEnv;
        this.items = [];
        this.push = function (envItem) {
            if (envItem instanceof EnvItem) {
                for (var i = 0; i < this.items.length; i++) {
                    if (this.items[i].name === envItem.name) {
                        this.items[i] = envItem;
                        break;
                    }
                }
                this.items.push(envItem);
            } else {
                throwError('Only envItem can be pushed to env');
            }
        };
        this.findIdentifier = function (str) {
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].name === str) {
                    return this.items[i].value;
                }
            }
            if (this.parent === null) {
                return null;
            }
            return this.parent.findIdentifier(str);
        };
    }

    function DefaultRootEnv() { // 默认的初始环境，系统刚开始运行时处于环境树的顶端
        this.parent = null;
        this.items = [
            new EnvItem('true', new SFormItem('true', TokenType.BOOLEAN)),
            new EnvItem('false', new SFormItem('false', TokenType.BOOLEAN)),
            new EnvItem('else', new SFormItem('true', TokenType.BOOLEAN)),
            new EnvItem('newline', new SFormItem('\n', TokenType.STRING)),
            new EnvItem('nil', new SFormItem([], TokenType.LIST)),
            new EnvItem('+', new SFormItem(function (params) {
                if (params.length <= 0) {
                    throwError("The + func accepts at least 1 parameter");
                }
                var sum = null;
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof  SForm) { // 如果是嵌套的form，递归执行
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            if (sum === null) {
                                sum = sItem.numVal;
                            } else {
                                sum += sItem.numVal;
                            }
                        } else if (sItem.type === TokenType.STRING) {
                            if (sum === null) {
                                sum = sItem.value;
                            } else {
                                sum += sItem.value;
                            }
                        } else if (sItem.type === TokenType.BOOLEAN) {
                            if (sum === null) {
                                sum = sItem.boolVal;
                            } else {
                                sum += sItem.boolVal;
                            }
                        } else {
                            throwError("This func only accepts number, string, and boolean value, but actually got " + sItem.value);
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                var resultType = TokenType.NUM;
                if (typeof(sum) === 'number') {
                    resultType = TokenType.NUM;
                } else if (typeof(sum) === 'boolean') {
                    resultType = TokenType.BOOLEAN;
                } else if (typeof(sum) === 'string') {
                    resultType = TokenType.STRING;
                } else {
                    throwError('unsupported result type');
                }
                return new SFormItem(sum, resultType);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('*', new SFormItem(function (params) {
                if (params.length <= 0) {
                    throwError("The + func accepts at least 1 parameter");
                }
                var sum = 1;
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof  SForm) { // 如果是嵌套的form，递归执行
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            sum *= sItem.numVal;
                        } else {
                            throwError("This func only accepts number, but actually got " + sItem.value);
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                return new SFormItem(sum, TokenType.NUM);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('-', new SFormItem(function (params) {
                if (params.length <= 0) {
                    throwError("The + func accepts at least 1 parameter");
                }
                var sum = 0;
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof  SForm) { // 如果是嵌套的form，递归执行
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            if (i === 0) {
                                sum = sItem.numVal;
                            } else {
                                sum -= sItem.numVal;
                            }
                        } else {
                            throwError("This func only accepts number, but actually got " + sItem.value);
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                return new SFormItem(sum, TokenType.NUM);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('/', new SFormItem(function (params) {
                if (params.length <= 0) {
                    throwError("The + func accepts at least 1 parameter");
                }
                var sum = 0;
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof  SForm) { // 如果是嵌套的form，递归执行
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            if (i === 0) {
                                sum = sItem.numVal;
                            } else {
                                sum /= sItem.numVal;
                            }
                        } else {
                            throwError("This func only accepts number, but actually got " + sItem.value);
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                return new SFormItem(sum, TokenType.NUM);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('<', new SFormItem(function (params) {
                if (params.length < 2) {
                    throwError('The func at least accepts 2 parameters');
                }
                var result = true;
                var values = [];
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            values[i] = sItem.numVal;
                        } else if (sItem.type === TokenType.STRING) {
                            values[i] = sItem.value;
                        } else if (sItem.type === TokenType.BOOLEAN) {
                            values[i] = sItem.boolVal;
                        } else {
                            throwError("Unsupported params to be compared");
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                for (var i = 0; i < values.length - 1; i++) {
                    // TODO: 分别根据values[i]和values[i+1]的类型进行比较
                    if (values[i] >= values[i + 1]) {
                        result = false;
                        break;
                    }
                }
                return new SFormItem(result ? 'true' : 'false', TokenType.BOOLEAN);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('>', new SFormItem(function (params) {
                if (params.length < 2) {
                    throwError('The func at least accepts 2 parameters');
                }
                var result = true;
                var values = [];
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            values[i] = sItem.numVal;
                        } else if (sItem.type === TokenType.STRING) {
                            values[i] = sItem.value;
                        } else if (sItem.type === TokenType.BOOLEAN) {
                            values[i] = sItem.boolVal;
                        } else {
                            throwError("Unsupported params to be compared");
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                for (var i = 0; i < values.length - 1; i++) {
                    // TODO: 分别根据values[i]和values[i+1]的类型进行比较
                    if (values[i] <= values[i + 1]) {
                        result = false;
                        break;
                    }
                }
                return new SFormItem(result ? 'true' : 'false', TokenType.BOOLEAN);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('=', new SFormItem(function (params) {
                if (params.length < 2) {
                    throwError('The func at least accepts 2 parameters');
                }
                var result = true;
                var values = [];
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.NUM) {
                            values[i] = sItem.numVal;
                        } else if (sItem.type === TokenType.STRING) {
                            values[i] = sItem.value;
                        } else if (sItem.type === TokenType.BOOLEAN) {
                            values[i] = sItem.boolVal;
                        } else {
                            throwError("Unsupported params to be compared");
                        }
                    } else {
                        throwError("The item " + sItem + " is not valid SFormItem");
                    }
                }
                for (var i = 0; i < values.length - 1; i++) {
                    // TODO: 分别根据values[i]和values[i+1]的类型进行比较
                    if (values[i] !== values[i + 1]) {
                        result = false;
                        break;
                    }
                }
                return new SFormItem(result ? 'true' : 'false', TokenType.BOOLEAN);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('not', new SFormItem(function (params) {
                if (params.length !== 1) {
                    throwError('The func only accept one parameter');
                }
                var sItem = params[0];
                if (sItem instanceof SForm) {
                    sItem = ss_eval_form_in_new_env(sItem);
                }
                if (sItem instanceof SFormItem) {
                    if (sItem.type === TokenType.ID) {
                        sItem = envTree.getIdentifierValue(sItem.value);
                    }
                    if (sItem.type === TokenType.BOOLEAN) {
                        return new SFormItem(!sItem.boolVal + '', TokenType.BOOLEAN);
                    } else {
                        throwError('only boolean value can be the parameter of the func');
                    }
                } else {
                    throwError('only SFormItem or SForm object can be transfered to the func');
                }
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('typeof', new SFormItem(function (params) {
                if (params.length !== 1) {
                    throwError('this func only accepts 1 parameter');
                }
                var sItem = params[0];
                if (sItem instanceof SForm) {
                    sItem = ss_eval_form_in_new_env(sItem);
                }
                if (sItem instanceof SFormItem) {
                    if (sItem.type === TokenType.ID) {
                        sItem = envTree.getIdentifierValue(sItem.value);
                    }
                    return new SFormItem(sItem.type, TokenType.STRING);
                } else {
                    throwError('only SFormItem or SForm object can be transfered to the func');
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('list', new SFormItem(function (params) {
                var list = [];
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        list.push(sItem);
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
                return new SFormItem(list, TokenType.LIST);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('list-len', new SFormItem(function (params) {
                if (params.length !== 1) {
                    throwError('this func only accepts 1 parameter value of list type');
                } else {
                    var lItem = params[0];
                    if (lItem instanceof SForm) {
                        lItem = ss_eval_form_in_new_env(lItem);
                    }
                    if (lItem instanceof SFormItem) {
                        if (lItem.type === TokenType.ID) {
                            lItem = envTree.getIdentifierValue(lItem.value);
                        }
                        if (lItem.type === TokenType.LIST) {
                            return new SFormItem(lItem.length + '', TokenType.NUM);
                        } else {
                            throwError('this func only accepts 1 parameter value of list type');
                        }
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('n-th', new SFormItem(function (params) {
                if (params.length !== 2) {
                    throwError('this func only accepts 2 parameter value of list type and value of num type');
                } else {
                    var lItem = params[0];
                    var nItem = params[1];
                    if (lItem instanceof SForm) {
                        lItem = ss_eval_form_in_new_env(lItem);
                    }
                    if (nItem instanceof SForm) {
                        nItem = ss_eval_form_in_new_env(nItem);
                    }
                    if (lItem instanceof SFormItem && nItem instanceof SFormItem) {
                        if (lItem.type === TokenType.ID) {
                            lItem = envTree.getIdentifierValue(lItem.value);
                        }
                        if (nItem.type === TokenType.ID) {
                            nItem = envTree.getIdentifierValue(nItem.value);
                        }
                        if (lItem.type === TokenType.LIST && nItem.type === TokenType.NUM) {
                            if (parseInt(nItem.numVal) >= lItem.length || parseInt(nItem.numVal) < 0) {
                                throwError('out of range of list');
                            } else {
                                var result = lItem.get(parseInt(nItem.numVal));
                                return result;
                            }
                        } else {
                            throwError('this func only accepts 2 parameter value of list type and value of num type');
                        }
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('cons', new SFormItem(function (params) { // TODO: now the cons is not the actual cons func in Scheme, it can accept more than 2 parameters
                var list = [];
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (sItem.type === TokenType.LIST) {
                            list = list.concat(sItem.value);
                        } else {
                            list.push(sItem);
                        }
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
                return new SFormItem(list, TokenType.LIST);
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('car', new SFormItem(function (params) {
                if (params.length !== 1) {
                    throwError('this func only accepts 1 parameter value of list type');
                } else {
                    var lItem = params[0];
                    if (lItem instanceof SForm) {
                        lItem = ss_eval_form_in_new_env(lItem);
                    }
                    if (lItem instanceof SFormItem) {
                        if (lItem.type === TokenType.ID) {
                            lItem = envTree.getIdentifierValue(lItem.value);
                        }
                        if (lItem.type === TokenType.LIST) {
                            if (lItem.length <= 0) {
                                throwError('out of range of list');
                            } else {
                                return lItem.get(0);
                            }
                        } else {
                            throwError('this func only accepts 1 parameter value of list type');
                        }
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('cdr', new SFormItem(function (params) {
                if (params.length !== 1) {
                    throwError('this func only accepts 1 parameter value of list type');
                } else {
                    var lItem = params[0];
                    if (lItem instanceof SForm) {
                        lItem = ss_eval_form_in_new_env(lItem);
                    }
                    if (lItem instanceof SFormItem) {
                        if (lItem.type === TokenType.ID) {
                            lItem = envTree.getIdentifierValue(lItem.value);
                        }
                        if (lItem.type === TokenType.LIST) {
                            if (lItem.length > 2) {
                                var newList = [];
                                for (var i = 1; i < lItem.length; i++) {
                                    newList.push(lItem.get(i));
                                }
                                return new SFormItem(newList, TokenType.LIST);
                            } else if (lItem.length === 2) {
                                return lItem.get(1);
                            } else {
                                return new SFormItem([], TokenType.LIST);
                            }
                        } else {
                            throwError('this func only accepts 1 parameter value of list type');
                        }
                    } else {
                        throwError('only SFormItem or SForm accepted');
                    }
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('cond', new SFormItem(function (params) {
                if (params.length < 1) {
                    throwError('This func at least accepts 1 parameter');
                }
                for (var i = 0; i < params.length; i++) {
                    var fItem = params[i];
                    if (fItem instanceof SForm) {
                        if (fItem.size() <= 3) {
                            throwError("this func's parameters must be forms which have at least 2 items");
                        } else {
                            var condItem = fItem.get(1);
                            if (condItem instanceof SForm || (condItem instanceof SFormItem && condItem.type === TokenType.ID)) {
                                var condVal = ss_eval_form_in_new_env(condItem);
                                if (condVal.type === TokenType.BOOLEAN) {
                                    if (condVal.boolVal === true) {
                                        var formList = new SFormList();
                                        for (var i = 2; i < fItem.size() - 1; i++) {
                                            formList.push(fItem.get(i));
                                        }
                                        if (formList.size() <= 0) {
                                            throwError('no body of this condition');
                                        } else {
                                            return ss_eval_forms_in_current_env(formList);
                                        }
                                    } else {
                                        continue;
                                    }
                                } else {
                                    throwError('only true or false condition accepted');
                                }
                            }
                        }
                    } else {
                        throwError('this func only accepts forms as parameters');
                    }
                }
                return new SFormItem('null', TokenType.NULL);
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('if', new SFormItem(function (params) {
                if (params.length < 2 || params.length > 3) {
                    throwError('This func only accepts 2 or 3 parameters');
                } else {
                    var testItem = params[0];
                    var trueDoItem = params[1];
                    var falseDoItem = params[2];
                    testItem = ss_eval_form_in_new_env(testItem);
                    if (testItem instanceof SFormItem) {
                        if (testItem.type !== TokenType.BOOLEAN) {
                            throwError('the test condition should be of boolean type value');
                        } else {
                            if (testItem.boolVal) {
                                return ss_eval_form_in_new_env(trueDoItem);
                            } else if (falseDoItem) {
                                return ss_eval_form_in_new_env(falseDoItem);
                            }
                        }
                    } else {
                        throwError('only SFormItem accepted');
                    }
                }
            }, TokenType.ORIGINAL_FUNC)) ,
            new EnvItem('defn', new SFormItem(function (params) {
                if (params.length < 2) {
                    throwError('This func at least accept 2 parameters');
                }
                var firstItem = params[0];
                var otherFormOrItems = new SFormList();
                for (var i = 1; i < params.length; i++) {
                    otherFormOrItems.push(params[i]);
                }
                if (!(firstItem instanceof SForm)) {
                    throwError('first parameter to define new func need to be SForm object');
                }
                if (firstItem.size() < 2) {
                    throwError('Wrong form');
                }
                var funcName = null;
                var funcParamNames = [];
                if (firstItem.size() > 2) {
                    funcName = firstItem.get(1);
                    for (var i = 2; i < firstItem.size() - 1; i++) {
                        var item = firstItem.get(i);
                        if (!(item instanceof SFormItem) || item.type !== TokenType.ID) {
                            throwError("define new func's params should be identifiers, but accept" + item);
                        }
                        funcParamNames.push(item.value);
                    }
                }
                var result = new SFormItem({
                    paramNames:funcParamNames,
                    boundParamNames:{},
                    body:otherFormOrItems
                }, TokenType.SS_FUNCTOR);
                envTree.curEnv.push(new EnvItem(funcName.value, result));
                return result;
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('lambda', new SFormItem(function (params) {
                if (params.length < 2) {
                    throwError('This func at least accept 2 parameters');
                }
                var firstItem = params[0];
                var otherFormOrItems = new SFormList();
                for (var i = 1; i < params.length; i++) {
                    otherFormOrItems.push(params[i]);
                }
                if (!(firstItem instanceof SForm)) {
                    throwError('first parameter to define new func need to be SForm object');
                }
                if (firstItem.size() < 2) {
                    throwError('Wrong form');
                }
                var funcParamNames = [];
                if (firstItem.size() > 2) {
                    for (var i = 1; i < firstItem.size() - 1; i++) {
                        var item = firstItem.get(i);
                        if (!(item instanceof SFormItem) || item.type !== TokenType.ID) {
                            throwError("define new func's params should be identifiers, but accept" + item);
                        }
                        funcParamNames.push(item.value);
                    }
                }
                var result = new SFormItem({
                    paramNames:funcParamNames,
                    boundParamNames:{},
                    body:otherFormOrItems
                }, TokenType.SS_FUNCTOR);
                return result;
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('define', new SFormItem(function (params) {
                if (params.length !== 2) {
                    throwError('The func only accepts 2 parameters');
                }
                var nameItem = params[0];
                var valueItem = params[1];
                if (nameItem instanceof SForm) {
                    nameItem = ss_eval_form_in_new_env(nameItem);
                }
                if (valueItem instanceof SForm) {
                    valueItem = ss_eval_form_in_new_env(valueItem);
                }
                if ((nameItem instanceof SFormItem) && (valueItem instanceof SFormItem)) {
                    if (nameItem.type !== TokenType.ID) {
                        throwError("The func can only define identifier");
                    }
                    if (valueItem.type === TokenType.ID) {
                        var value = envTree.curEnv.findIdentifier(valueItem.value);
                        if (value === null) {
                            throwError("The func's second parameter is of no sense");
                        }
                        valueItem = value;
                    }
                    if (valueItem.type === TokenType.COMMENT || valueItem.type === TokenType.FORM_START || valueItem.type === TokenType.FORM_END || valueItem.type === TokenType.SPECIAL_SYMBOL) {
                        throwError("The func's second parameter is of no sense");
                    }
                    envTree.curEnv.push(new EnvItem(nameItem.value, valueItem));
                    return new SFormItem('null', TokenType.NULL);
                }
                throwError("unknown parameters" + nameItem + 'and ' + valueItem);
            }, TokenType.ORIGINAL_FUNC)),
            new EnvItem('display', new SFormItem(function (params) {
                var str = '';
                for (var i = 0; i < params.length; i++) {
                    var sItem = params[i];
                    if (sItem instanceof SForm) {
                        sItem = ss_eval_form_in_new_env(sItem);
                    }
                    if (sItem instanceof SFormItem) {
                        if (sItem.type === TokenType.ID) {
                            sItem = envTree.getIdentifierValue(sItem.value);
                        }
                        if (i !== 0) {
                            str += ' ';
                        }
                        str += sItem.toString();
                    }
                }
                output(str);
                return new SFormItem('null', TokenType.NULL);
            }, TokenType.ORIGINAL_FUNC))
        ];
        this.push = function (envItem) {
            if (envItem instanceof EnvItem) {
                for (var i = 0; i < this.items.length; i++) {
                    if (this.items[i].name === envItem.name) {
                        this.items[i] = envItem;
                        break;
                    }
                }
                this.items.push(envItem);
            } else {
                throwError('Only envItem can be pushed to env');
            }
        };
        this.findIdentifier = function (str) {
            for (var i = 0; i < this.items.length; i++) {
                if (this.items[i].name === str) {
                    return this.items[i].value;
                }
            }
            if (this.parent === null) {
                return null;
            }
            return this.parent.findIdentifier(str);
        };
    }

    function s_apply_in_current_env(_funcItem, _paramItemList) {
        if (_funcItem instanceof SForm) {
            _funcItem = ss_eval_form_in_new_env(_funcItem);
        }
        if (_funcItem instanceof SFormItem) {
            if (_funcItem.type === TokenType.ID) {
                _funcItem = envTree.curEnv.findIdentifier(_funcItem.value);
            }
            if (!(_funcItem.type === TokenType.ORIGINAL_FUNC || _funcItem.type === TokenType.SS_FUNCTOR)) {
                throwError('Only func can be applied, but accepts ' + _funcItem.type + ': ' + _funcItem.value);
            } else if (_funcItem.type === TokenType.ORIGINAL_FUNC) {
                var func = _funcItem.value;
                return func(_paramItemList);
            } else {
                if (_paramItemList.length > _funcItem.funcParamNames.length) {
                    throwError('too more parameters for the function');
                }
                for (var i = 0; i < _paramItemList.length; i++) {
                    if (_paramItemList[i] instanceof SForm) {
                        _paramItemList[i] = ss_eval_form_in_new_env(_paramItemList[i]);
                    }
                    if (_paramItemList[i] instanceof SFormItem) {
                        if (_paramItemList[i].type === TokenType.ID) {
                            var item = envTree.curEnv.findIdentifier(_paramItemList[i].value);
                            if (item === null) {
                                throwError('Using undefined identifier');
                            } else {
                                _paramItemList[i] = item;
                            }
                        }
                    } else {
                        throwError('only SFormItems are accepted');
                    }
                }
                if (_paramItemList.length === _funcItem.funcParamNames.length) {
                    var newEnv = new Env(envTree.curEnv);
                    envTree.curEnv = newEnv;
                    for (var paramName in _funcItem.funcBoundParams) {
                        envTree.curEnv.push(new EnvItem(paramName, _funcItem.funcBoundParams[paramName]));
                    }
                    for (var i = 0; i < _funcItem.funcParamNames.length; i++) {
                        envTree.curEnv.push(new EnvItem(_funcItem.funcParamNames[i], _paramItemList[i]));
                    }
                    var result = ss_eval_forms_in_current_env(_funcItem.funcBody);
                    envTree.curEnv = envTree.curEnv.parent;
                    return result;
                } else { // not enough parameters, currying
                    var boundParams = _funcItem.funcBoundParams;
                    var remainingParams = [];
                    for (var i = 0; i < _funcItem.funcParamNames.length; i++) {
                        if (i < _paramItemList.length) {
                            boundParams[_funcItem.funcParamNames[i]] = _paramItemList[i];
                        } else {
                            remainingParams.push(_funcItem.funcParamNames[i]);
                        }
                    }
                    return new SFormItem({
                        paramNames:remainingParams,
                        boundParamNames:boundParams,
                        body:_funcItem.funcBody
                    }, TokenType.SS_FUNCTOR);
                }
            }
        } else {
            throwError("Unknown parameter of s_apply_in_current_env");
        }
    }

    DefaultRootEnv.prototype = new Env();

    function ss_eval_form_in_current_env(form) {
        if (form instanceof SFormItem) {
            if (form.type === TokenType.ID) {
                return envTree.getIdentifierValue(form.value);
            } else {
                return form;
            }
        }
        if (!(form instanceof SForm)) {
            throwError("only form and form item can be evaled");
        }
        if (form.size() <= 2) {
            throwError("empty form can't be evaled:" + form.display());
        } else {
            var funcItem = form.get(1);
            var paramItems = [];
            for (var i = 2; i < form.size() - 1; i++) {
                paramItems.push(form.get(i));
            }
            if (funcItem instanceof SForm) {
                funcItem = ss_eval_form_in_new_env(funcItem);
            }
            if (funcItem instanceof SFormItem) {
                if (funcItem.type === TokenType.ID) {
                    funcItem = envTree.getIdentifierValue(funcItem.value);
                }
                var result = s_apply_in_current_env(funcItem, paramItems);
                return result;
            } else {
                throwError('only accept SFormItem or SForm');
            }
        }
    }

    function ss_eval_form_in_new_env(form) {
        var env = new Env(envTree.curEnv);
        envTree.curEnv = env;
        var result = ss_eval_form_in_current_env(form);
        envTree.curEnv = env.parent;
        return result;
    }

    function ss_eval_forms_in_current_env(forms) {
        forms.removeComments();
        var result = null;
        for (var i = 0; i < forms.size(); i++) {
            var form = forms.get(i);
            result = ss_eval_form_in_current_env(form);
        }
        if (result === null) {
            throwError('Unexpected result');
        } else if (result instanceof SFormItem) {
            return result;
        } else {
            return result;
        }
    }

    function ss_eval(str, outputHandler, errorHandler) {
        ss.outputHandler = outputHandler || function (str) {
            console.log(str);
        };
        ss.errorHandler = errorHandler || function (str) {
            throw new Error(str);
        };
        var forms = lexAnalise(str);
        return ss_eval_forms_in_current_env(forms);
    }

    context.ss_eval = ss_eval;
})(context);