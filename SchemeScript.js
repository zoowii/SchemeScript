(function (context) {
    "use strict";
    var _ = require('./underscore.js')._;

    function output(item) {
        console.log(item);
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
        NO_RETURN_RESULT:'NO_RETURN_RESULT'
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
            this.funcBody = this.value.body;
        }
        this.display = function () {
            return "value:\t" + this.value + "\t" + this.type;
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
        throw new Error(msg);
    };

    var EnvItem = function (name, value) {
        this.name = name;
        this.value = value;
    };

    var EnvTree = function () {
        this.curEnv = new DefaultRootEnv();
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
            new EnvItem('+', new SFormItem(function (params) {
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
                            var item = envTree.curEnv.findIdentifier(sItem.value);
                            if (item === null) {
                                throwError('un defined identifier of ' + sItem.value);
                            } else {
                                sItem = item;
                            }
                        }
                        if (sItem.type === TokenType.NUM) {
                            sum += sItem.numVal;
                        } else {
                            throwError("The + func only accepts number, but actually got " + sItem.value);
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
                            var item = envTree.curEnv.findIdentifier(sItem.value);
                            if (item === null) {
                                throwError("the identifier '" + sItem.value + "' can not be found");
                            }
                            sItem = item;
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
                            var item = envTree.curEnv.findIdentifier(sItem.value);
                            if (item === null) {
                                throwError("the identifier '" + sItem.value + "' can not be found");
                            }
                            sItem = item;
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
                            var item = envTree.curEnv.findIdentifier(sItem.value);
                            if (item === null) {
                                throwError("the identifier '" + sItem.value + "' can not be found");
                            }
                            sItem = item;
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
                        var item = envTree.curEnv.findIdentifier(sItem.value);
                        if (item === null) {
                            throwError("the identifier '" + sItem.value + "' can not be found");
                        }
                        sItem = item;
                    }
                    if (sItem.type === TokenType.BOOLEAN) {
                        return new SFormItem(!sItem.boolVal + '', TokenType.BOOLEAN);
                    } else {
                        throwError('only boolean value can be the parameter of the func');
                    }
                } else {
                    throwError('only SFormItem object can be transfered to the func');
                }
            }, TokenType.ORIGINAL_FUNC)),
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
                    body:otherFormOrItems
                }, TokenType.SS_FUNCTOR);
                envTree.curEnv.push(new EnvItem(funcName.value, result));
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
                    if (!(valueItem.type === TokenType.NUM || valueItem.type === TokenType.STRING || valueItem.type === TokenType.ORIGINAL_FUNC || valueItem.type === TokenType.BOOLEAN)) {
                        throwError("The func's second parameter is of no sense");
                    }
                    envTree.curEnv.push(new EnvItem(nameItem.value, valueItem));
                    return new SFormItem(undefined, TokenType.NO_RETURN_RESULT);
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
                            var item = envTree.curEnv.findIdentifier(sItem.value);
                            if (item === null) {
                                throwError('The identifier ' + sItem.value + " can't be found int env");
                            } else {
                                sItem = item;
                            }
                        }
                        if (i !== 0) {
                            str += ' ';
                        }
                        str += sItem.value;
                    }
                }
                output(str);
                return new SFormItem(undefined, TokenType.NO_RETURN_RESULT);
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
            _funcItem = ss_eval_form_in_current_env(_funcItem);
        }
        if (_funcItem instanceof SFormItem) {
            if (_funcItem.type === TokenType.ID) {
                _funcItem = envTree.curEnv.findIdentifier(_funcItem.value);
            }
            if (!(_funcItem.type === TokenType.ORIGINAL_FUNC || _funcItem.type === TokenType.SS_FUNCTOR)) {
                throwError('Only func can be applied, but accepts ' + _funcItem.type);
            } else if (_funcItem.type === TokenType.ORIGINAL_FUNC) {
                var func = _funcItem.value;
                return func(_paramItemList);
            } else {
                if (_paramItemList.length !== _funcItem.funcParamNames.length) {
                    throwError('call function with wrong number of parameters count');
                }        // TODO: 当输入参数不足时，柯里化，即长生一个新的函数
                for (var i = 0; i < _paramItemList.length; i++) {
                    if (_paramItemList[i] instanceof SForm) {
                        _paramItemList[i] = ss_eval_form_in_current_env(_paramItemList[i]);
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
                var newEnv = new Env(envTree.curEnv);
                envTree.curEnv = newEnv;
                for (var i = 0; i < _funcItem.funcParamNames.length; i++) {
                    envTree.curEnv.push(new EnvItem(_funcItem.funcParamNames[i], _paramItemList[i]));
                }
                var result = ss_eval_forms_in_current_env(_funcItem.funcBody);
                envTree.curEnv = envTree.parent;
                return result;
            }
        } else {
            throwError("Unknown parameter of s_apply_in_current_env");
        }
    }

    DefaultRootEnv.prototype = new Env();

    function ss_eval_form_in_current_env(form) {
        if (form instanceof SFormItem) {
            if (form.type === TokenType.ID) {
                var item = envTree.curEnv.findIdentifier(form.value);
                if (item === null) {
                    throwError('un defined identifier');
                } else {
                    return item;
                }
            } else {
                return form;
            }
        }
        if (!(form instanceof SForm)) {
            throwError("only form can be evaled");
        }
        if (form.size() <= 2) {
            throwError("empty form can't be evaled:" + form.display());
        } else {
//        if (!form.hasNested()) {  // 没有嵌套的form
            var p1 = form.items.pop();
            var s1 = form.items.shift();
            var funcItem = form.get(0);
            var s2 = form.items.shift();
            var paramItems = form.items;
            var result = s_apply_in_current_env(funcItem, paramItems);
            form.push(p1);
            form.unshift(s2);
            form.unshift(s1);
            return result;
//        } else {
//            for (var i = 0; i < form.size(); i++) {
//                var item = form.get(i);
//                if (item instanceof SForm) {
//                    item = ss_eval_form_in_new_env(item);
//                    form.items[i] = item;
//                }
//            }
//            return ss_eval_form_in_current_env(form);
//        }
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
            return result; // TODO: throw error
        } else if (result instanceof SFormItem) {
            return result;
        } else {
            return result;
        }
    }

    function ss_eval(str) {
        var forms = lexAnalise(str);
        return ss_eval_forms_in_current_env(forms);
    }

    exports.ss_eval = ss_eval;
})(exports);