jQuery 的 callbacks 详解

时间队列，观察者模式

首先看传入参数 option

可为 once unique stopOnfalse memory
可以是单独或者组合，组合如 once memory

第一步先转换 option 成对象
如把 once memory 转成
{
	once: true,
	memory: true
}

之后看定义的私有变量

firing
memory
fired
locked
list = []
queue = []
firingIndex = -1
fire = function () { ... }
self = {
	key: function () { ... }
}

最后
return self

大体该函数就是这样

先分析 self 这个对象

// add 涉及到了 queue 与 list
add: function (...rest) {
	if (list) {
		// 此处涉及了 queue
		// 如果有 memory 且不在 fire 过程中
		if (memory && !firing) {
			firingIndex = list.length - 1;
			// 把 memory 加入 queue 中
			queue.push( memory );
		}

		// 此处涉及 list
		(function add(args) {
			jQuery.each(args, function (index, item) {
				if (jQuery.isFunction(item)) {
					// 若 非unique 且 list 中不包含 item 
					if (!option.unique && !self.has(item)) {
						list.push(arg);
					}
				// 对于 item 为数组的递归加入 list
				} else if (item && item.length && item.type(arg) !== 'string') {
					add(arg)
				}
			})
		})(rest)

		// 如果有 memory 且不在 fire 过程中  fire !!!
		// fire 新添加的函数
		if (memory && !firing) {
			fire();
		}

		return this;
	}
}

remove: function (...rest) {
	jQuery.each(rest, function (index, item) {
		var i = jQuery.inArray(item, list);
		while(i !== -1) {
			list.splice(i, 1);
			
			// 需要把 firingIndex 减去1
			if (i <= firingIndex) {
				firingIndex--;
			}

			// 要把 list 全部的 item 给删光
			i = jQuery.inArray(item, list);
		}
	})
}

// 就如果传了 fn, 看 list 里面是否有 fn, 否则看 list 的长度
has: function (fn) {
	return fn ? jQuery.inArray(fn, list) : list.length > 0;
}

// 清空 list
empty: function () {
	if (list) {
		list = [];
	}
	return list;
}

// 清空的 locked 与 queue, 把 list 与 memory 转为空
disable: function () {
	locked = queue = [];
	list = memory = '';
	return this;
}

// 看是否处于 disable 的状态, 即检测是否有list, 没有就是 disable
// self.disable 触发就会是locked
// self.lock 触发要是 memory 为空且不在 firing 的状态
disabled: function () {
	return !list;
}

// 若记忆为空且不处于 firing 的状态, 将 list 设成空
lock: function () {
	locked = queue = []; // 将 locked 与 queue 清空
	if (!memory && !firing) {
		list = '';
		// memory = ''; // 这里根本没啥意义, 已经必定 !memory 为 true 了, 也就是说 memory 为空了
	}
}

// 看是否在 lock 的状态, 看 lock 有没, 有就是 locked
// self.disable 与 self.lock 触发就会是locked
locked: function () {
	return !!locked;
}

fireWith: function (context, args) {
	if (!locked) {
		// 若不存在 args, args 弄成 []
		args = args || [];
		// args unshift context, 且若 args 为数组就浅复制args
		args = [context, args.slice ? args.slice() : args];
		queue.push(args);
		if (!firing) {
			fire();
		}
	}
}

// 因为 return 的是 self, 那么是谁 xx = $.callback(option); 基本 xx 就是那个this了
fire: function (...rest) {
	self.fireWith(this, rest);
	return this;
}

// 看是否在 fired 的状态, 看 fired 有没, 有就是 fired
fired: function() {
	return !!fired;
}

最后看重头戏私有函数 fire 函数

// 这玩意烦在 list[firingIndex].apply(memory[0], memory[1]) 
// 不知道他的 list 的东西是否循环调用的
// 如 
// var callbacks = $.Callbacks( "memory" );
// callbacks.add(function(value) { return callbacks.add(function(value) { console.log(value) }) })
// 不过应该没哪个操蛋的人会这样写,但是这里就考虑了这情况,导致看起来复杂多了
firing = function () {
	// once 就表示 locked 了
	locked = locked || option.once;

	// 就把 fired 设成了 true 了
	fired = firing = true;

	// 在这我不得不MMP, jQuery 写法是 for ( ; queue.length; firingIndex = -1 ) 看着就操蛋
	// 这里可以看出 queue 是参数, list 是函数
	// 之后对于涉及 queue 的有 add 与 fireWith
	// fireWith 加入了 queue, 而 add 会把 memory 加回来
	// 可以说 queue 基本就只是一个
	while (queue.length) {
		// memory 就是最后的queue
		memory = queue.shift();
		// list 就基本总是存在 
		// list 会对 queue 循环调用
		while (++firingIndex < list.length) {
			var result = list[firingIndex].apply(memory[0], memory[1]);
			if (result === false && options.stopOnFalse) {
				firingIndex = list.length;
				memory = '';
			}
		}
		firingIndex = -1;
	}

	// options 的 memory 为 true 才可能储存下memory
	if (!options.memory) {
		memory = ''
	};

	firing = false;

	if (locked) {
		if (memory) {
			list = []
		// 没有 memory, 那 list 就为空, 那连 add 都 add 不了
		} else {
			list = ''
		}
	}
}


// fire 新添加函数例子
cb.add(function (name) {
    console.log('one', name);
});
cb.fire('Jacky');//first Jacky
cb.add(function (name) {
    console.log('two', name);
});//two Jacky
