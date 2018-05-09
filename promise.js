jQuery 的 promise 详解
用了 jQuery 的 callback

var tuples = [

	// action, add listener, callbacks, .then handlers, argument index, [final state]
	// 以上为各个参数意义
	// 4 根本没用, MMP的弄成数组,我每次看各个代表什么,需要返回来看,反人类,长的完全应该设置成对象
	[ "notify", "progress", jQuery.Callbacks( "memory" ), jQuery.Callbacks( "memory" ), 2 ],
	[ "resolve", "done", jQuery.Callbacks( "once memory" ), jQuery.Callbacks( "once memory" ), 0, "resolved" ],
	[ "reject", "fail", jQuery.Callbacks( "once memory" ), jQuery.Callbacks( "once memory" ), 1, "rejected" ]
];

注意 这里就 0 是 memory

首先看 tuples 这个变量名字

python 有这种格式 元组
元组（tuples）是由其它类型组合而成的类型。元组可能包含零或多个类型，比如 字符串、整数、字符、布尔以及其它元组
更加详细的就不管了,没看过python

重新强调 memory 会记录传入的参数, 每当add, 会自动执行add的函数,参数为上次的参数

once memory 则是 无论 fire 什么,只有第一次 fire 有效 (包括add自动执行的) 再也没有效果


var state = "pending";

state 应该有三种 pending resolved rejected 
看 tuples[0] 最后是没有 final state 的, 其实就是 pending


再看定义的一个对象

var promise = {...}

state: function () {
	return state;
}

always: function (...rest) {
	deferred.done(rest).fail(rest);
	return this;
}

catch: function (fn) {
	return promise.then(null, fn);
}

// Deprecated > Deprecated 1.8
pipe: function () {...}

// 可以猜出是参数分别是  完成, 报错, 进行中的回调函数
then: function (onFulfilled, onRejected, onPropgress) {...}

// 把 promise 的 所有属性 extends 到 obj 上
promise: function( obj ) {
	return obj != null ? jQuery.extend( obj, promise ) : promise;
}

deferred = {};

tuples.forEach(function (item, index) {
	// 2 是 callback
	var list = item[2];
	
	// 5 是 undefined(实际是pending), resolved, rejected
	var stateString = item[5];

	// 1 是 progress, done, fail
	// 给 promise 对象加上 progress, done, fail 属性
	promise[item[1]] = list.add;

	if (stateString) {
		if (stateString === 'resolved') {
			// 依次执行三个函数
			// disable 把 reject 的 locked 与 queue 设成空数组,  list 与 memory 转为空字符串, 即 reject 的 firing 不起作用了
			// lock 把 pending 的 locked 与 queue 设成空数组, 若 memory 为空, list 设为空字符串
			list.add(
				() => (state = stateString),
				tuples[2][2].disable, 
				tuples[0][2].lock
			);
		} else if (stateString === 'rejected') {
			// 类似 resolved 的
			list.add(
				() => (state = stateString),
				tuples[1][2].disable,
				tuples[0][2].lock
			);
		}
	}

	// 3 为 then handlers
	// 该句函数需要特别注意, 就是触发了 item[2], 就是这里的变量list 上的 fire,
	// 那最后就触发了 item[3] 上面的 list 的函数
	// item[3] 的函数 add 在 then 上 add 了
	list.add(item[3].fire);
	// 现在 list 上面有
	// [() => (state = stateString)],
	// [tuples[reverse][2].disable], 
	// [tuples[0][2].lock]
	// then handlers
	// 而且 若是 deferre.[progress || done || fail] 也是 list.add, 即把函数也加在 list 上面

	// 0 是 notify, resolve, reject
	// 给 deferred 添加 notifyWith, resolveWith, rejectWith 属性
	// 此处 list 已经 add 好函数了
	deferred[tuple[0] + 'With'] = list.fireWith;

	// 给 deferred 添加 notify, resolve, reject 属性
	deferred[tuple[0]] = function (...rest) {
		deferred[tuple[0] + 'With'](this === deferred ? undefined : deferred, rest);
		return this;
	};
});

// 执行了个函数
// 拓展了 deferred 的属性, 把 promise 的所有属性拓展上来了
promise.promise(deferred);

// 又执行个函数
if (func) {
	func.call(deferred, deferred);
}

// 最后的返回
return deferred;



最后把 then 提出来看
then: function (onFulfilled, onRejected, onPropgress) {
	var maxDepth = 0;

	// resolve 函数开始
	// handler 就是 对应的 onFulfilled || onRejected || onPropgress
	// special 就只有 newDefer.notifyWith
	function resolve(depth, deferred, handler, special) {
		// 这里的 rest 就是 fire 传入的参数
		return function (...rest) {
			var that = this;
			var args = rest;

			// mightThrow 函数开始
			var mightThrow = function () {
				var returned;
				var then;

				if (depth < maxDepth) {
					return;
				}

				// 这个 returned 就是 then 里面传的函数的 return 的东西
				returned = handler.apply(that, args);

				if (returned === deferred.promise()) {
					throw new TypeError('Thenable self-resolution');
				}

				// 看 returned 是否个 promise 对象
				then = returned && (
							typeof returned === 'object' ||
							typeof returned === 'function'
					) && returned.then;

				if (jQuery.isFunction(then)) {
					if (special) {
						// 传入的为 then 的 onFulfilled, onRejected
						then.call(
							returned,
							resolve(maxDepth, deferred, (v) => v, special),
							resolve(maxDepth, deferred, (err) => throw err, special)
						);
					} else {
						maxDepth++;
						// 传入的为 then 的 onFulfilled, onRejected, onPropgress
						then.call(
							returned,
							resolve(maxDepth, deferred, (v) => v, special),
							resolve(maxDepth, deferred, (err) => throw err, special),
							resolve(maxDepth, deferred, (v) => v, deferred.notifyWith)		
						)
					}
				}
			};
			// mightThrow 函数结束

			// process 函数开始
			var process;
			if (special) {
				process = mightThrow;
			} else {
				process = function () {
					try {
						mightThrow();
					} catch (e) {
						if (jQuery.Deferred.exceptionHook) {
							jQuery.Deferred.exceptionHook(e, process.stackTrace);
						}
						if (depth + 1 >= maxDepth) {
							// 其实原本是 handler !== Thrower 
							// 此处只是为了直观, 我把Thrower直接以函数显示
							if (handler !== (err) => throw err) {
								that = undefined;
								args = [e];
							}
							deferred.rejectWith(that, args);
						}
					}
				}
			}
			// process 函数结束

			// 正式的 resolve 函数开始
			// 当传入的 then 的处理函数返回的是 promise 对象, 且触发的不是 notify, 那 depth 就不是 0
			if (depth) {
				process();
			} else {
				if (jQuery.Deferred.getStackHook) {
					process.stackTrace = jQuery.Deferred.getStackHook();
				}
				window.setTimeout(process);
			}

		}
	}
	// resolve 函数结束

	// 正式的 then 函数开始

	// jQuery.Deferred() 很显然没执行 func.call(deferred, deferred) , 返回的是一个 "纯净的deferred"
	// 如今多了个 func 参数传入
	// 那 this 就是 纯净的deferred, 参数newDefer 等于 this, 同样的纯净的 newDefer
	// 这里返回的是 jQuery.Deferred(func).promise();
	// 砍回 promise()  这里 返回的 相比 deferred 少了 notify(With) resolve(With) reject(With) 六个属性
	return jQuery.Deferred(function (newDefer) {
		// 0 为 pending
		// 3 为 then handlers
		// 上方 list.add(item[3].fire); 就是 fire 这里的 resolve(...) 了
		tuples[0][3].add(
			resolve(
				0,
				newDefer,
				// 看 then 函数传了 progress 的回调函数有无
				jQuery.isFunction(onProgress) ? onProgress : (v) => v,
				newDefer.notifyWith
			)
		);

		// 1 为 resolve
		tuples[1][3].add(
			resolve(
				0,
				newDefer,
				jQuery.isFunction(onFulfilled) ? onFulfilled : (v) => v
			)
		);

		// 2 为 reject
		tuples[2][3].add(
			resolve(
				0,
				newDefer,
				jQuery.isFunction(onRejected) ? onRejected : (e) => throw e
			)
		);
	}).promise();
	// 正式的 then 函数结束
}