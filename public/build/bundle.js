
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/App.svelte generated by Svelte v3.22.3 */

    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let form;
    	let div0;
    	let input0;
    	let t0;
    	let label0;
    	let t2;
    	let div1;
    	let input1;
    	let input1_type_value;
    	let t3;
    	let label1;
    	let t5;
    	let span0;
    	let t6_value = (/*showPassword*/ ctx[2] ? "🙈" : "👁") + "";
    	let t6;
    	let t7;
    	let div2;
    	let span1;
    	let t8;
    	let span2;
    	let t9;
    	let span3;
    	let t10;
    	let span4;
    	let t11;
    	let ul;
    	let li0;
    	let t12_value = (/*validations*/ ctx[1][0] ? "✅" : "❌") + "";
    	let t12;
    	let t13;
    	let t14;
    	let li1;
    	let t15_value = (/*validations*/ ctx[1][1] ? "✅" : "❌") + "";
    	let t15;
    	let t16;
    	let t17;
    	let li2;
    	let t18_value = (/*validations*/ ctx[1][2] ? "✅" : "❌") + "";
    	let t18;
    	let t19;
    	let t20;
    	let li3;
    	let t21_value = (/*validations*/ ctx[1][3] ? "✅" : "❌") + "";
    	let t21;
    	let t22;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			form = element("form");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			label0 = element("label");
    			label0.textContent = "Email";
    			t2 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "Password";
    			t5 = space();
    			span0 = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			div2 = element("div");
    			span1 = element("span");
    			t8 = space();
    			span2 = element("span");
    			t9 = space();
    			span3 = element("span");
    			t10 = space();
    			span4 = element("span");
    			t11 = space();
    			ul = element("ul");
    			li0 = element("li");
    			t12 = text(t12_value);
    			t13 = text(" must be at least 5 characters");
    			t14 = space();
    			li1 = element("li");
    			t15 = text(t15_value);
    			t16 = text(" must contain a capital letter");
    			t17 = space();
    			li2 = element("li");
    			t18 = text(t18_value);
    			t19 = text(" must contain a number");
    			t20 = space();
    			li3 = element("li");
    			t21 = text(t21_value);
    			t22 = text(" must contain one of $&+,:;=?@#");
    			attr_dev(input0, "type", "email");
    			attr_dev(input0, "name", "email");
    			attr_dev(input0, "class", "input svelte-eekjeg");
    			attr_dev(input0, "placeholder", " ");
    			add_location(input0, file, 135, 6, 2562);
    			attr_dev(label0, "for", "email");
    			attr_dev(label0, "class", "label svelte-eekjeg");
    			add_location(label0, file, 136, 6, 2634);
    			attr_dev(div0, "class", "field svelte-eekjeg");
    			add_location(div0, file, 134, 4, 2536);
    			attr_dev(input1, "type", input1_type_value = /*showPassword*/ ctx[2] ? "text" : "password");
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "class", "input svelte-eekjeg");
    			attr_dev(input1, "placeholder", "\n        ");
    			add_location(input1, file, 139, 6, 2722);
    			attr_dev(label1, "for", "password");
    			attr_dev(label1, "class", "label svelte-eekjeg");
    			add_location(label1, file, 146, 6, 2902);
    			attr_dev(span0, "class", "toggle-password svelte-eekjeg");
    			add_location(span0, file, 147, 6, 2961);
    			attr_dev(div1, "class", "field svelte-eekjeg");
    			add_location(div1, file, 138, 4, 2696);
    			attr_dev(span1, "class", "bar bar-1 svelte-eekjeg");
    			toggle_class(span1, "bar-show", /*strength*/ ctx[0] > 0);
    			add_location(span1, file, 155, 6, 3200);
    			attr_dev(span2, "class", "bar bar-2 svelte-eekjeg");
    			toggle_class(span2, "bar-show", /*strength*/ ctx[0] > 1);
    			add_location(span2, file, 156, 6, 3263);
    			attr_dev(span3, "class", "bar bar-3 svelte-eekjeg");
    			toggle_class(span3, "bar-show", /*strength*/ ctx[0] > 2);
    			add_location(span3, file, 157, 6, 3326);
    			attr_dev(span4, "class", "bar bar-4 svelte-eekjeg");
    			toggle_class(span4, "bar-show", /*strength*/ ctx[0] > 3);
    			add_location(span4, file, 158, 6, 3389);
    			attr_dev(div2, "class", "strength svelte-eekjeg");
    			add_location(div2, file, 154, 4, 3171);
    			add_location(li0, file, 161, 6, 3472);
    			add_location(li1, file, 162, 6, 3546);
    			add_location(li2, file, 163, 6, 3620);
    			add_location(li3, file, 164, 6, 3686);
    			add_location(ul, file, 160, 4, 3461);
    			attr_dev(form, "class", "svelte-eekjeg");
    			add_location(form, file, 133, 2, 2525);
    			add_location(main, file, 132, 0, 2516);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor, remount) {
    			insert_dev(target, main, anchor);
    			append_dev(main, form);
    			append_dev(form, div0);
    			append_dev(div0, input0);
    			append_dev(div0, t0);
    			append_dev(div0, label0);
    			append_dev(form, t2);
    			append_dev(form, div1);
    			append_dev(div1, input1);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(div1, t5);
    			append_dev(div1, span0);
    			append_dev(span0, t6);
    			append_dev(form, t7);
    			append_dev(form, div2);
    			append_dev(div2, span1);
    			append_dev(div2, t8);
    			append_dev(div2, span2);
    			append_dev(div2, t9);
    			append_dev(div2, span3);
    			append_dev(div2, t10);
    			append_dev(div2, span4);
    			append_dev(form, t11);
    			append_dev(form, ul);
    			append_dev(ul, li0);
    			append_dev(li0, t12);
    			append_dev(li0, t13);
    			append_dev(ul, t14);
    			append_dev(ul, li1);
    			append_dev(li1, t15);
    			append_dev(li1, t16);
    			append_dev(ul, t17);
    			append_dev(ul, li2);
    			append_dev(li2, t18);
    			append_dev(li2, t19);
    			append_dev(ul, t20);
    			append_dev(ul, li3);
    			append_dev(li3, t21);
    			append_dev(li3, t22);
    			if (remount) run_all(dispose);

    			dispose = [
    				listen_dev(input1, "input", /*validatePassword*/ ctx[3], false, false, false),
    				listen_dev(span0, "mouseenter", /*mouseenter_handler*/ ctx[4], false, false, false),
    				listen_dev(span0, "mouseleave", /*mouseleave_handler*/ ctx[5], false, false, false)
    			];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*showPassword*/ 4 && input1_type_value !== (input1_type_value = /*showPassword*/ ctx[2] ? "text" : "password")) {
    				attr_dev(input1, "type", input1_type_value);
    			}

    			if (dirty & /*showPassword*/ 4 && t6_value !== (t6_value = (/*showPassword*/ ctx[2] ? "🙈" : "👁") + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*strength*/ 1) {
    				toggle_class(span1, "bar-show", /*strength*/ ctx[0] > 0);
    			}

    			if (dirty & /*strength*/ 1) {
    				toggle_class(span2, "bar-show", /*strength*/ ctx[0] > 1);
    			}

    			if (dirty & /*strength*/ 1) {
    				toggle_class(span3, "bar-show", /*strength*/ ctx[0] > 2);
    			}

    			if (dirty & /*strength*/ 1) {
    				toggle_class(span4, "bar-show", /*strength*/ ctx[0] > 3);
    			}

    			if (dirty & /*validations*/ 2 && t12_value !== (t12_value = (/*validations*/ ctx[1][0] ? "✅" : "❌") + "")) set_data_dev(t12, t12_value);
    			if (dirty & /*validations*/ 2 && t15_value !== (t15_value = (/*validations*/ ctx[1][1] ? "✅" : "❌") + "")) set_data_dev(t15, t15_value);
    			if (dirty & /*validations*/ 2 && t18_value !== (t18_value = (/*validations*/ ctx[1][2] ? "✅" : "❌") + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*validations*/ 2 && t21_value !== (t21_value = (/*validations*/ ctx[1][3] ? "✅" : "❌") + "")) set_data_dev(t21, t21_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let strength = 0;
    	let validations = [];
    	let showPassword = false;

    	function validatePassword(e) {
    		const password = e.target.value;

    		$$invalidate(1, validations = [
    			password.length > 5,
    			password.search(/[A-Z]/) > -1,
    			password.search(/[0-9]/) > -1,
    			password.search(/[$&+,:;=?@#]/) > -1
    		]);

    		$$invalidate(0, strength = validations.reduce((acc, cur) => acc + cur));
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	const mouseenter_handler = () => $$invalidate(2, showPassword = true);
    	const mouseleave_handler = () => $$invalidate(2, showPassword = false);

    	$$self.$capture_state = () => ({
    		strength,
    		validations,
    		showPassword,
    		validatePassword
    	});

    	$$self.$inject_state = $$props => {
    		if ("strength" in $$props) $$invalidate(0, strength = $$props.strength);
    		if ("validations" in $$props) $$invalidate(1, validations = $$props.validations);
    		if ("showPassword" in $$props) $$invalidate(2, showPassword = $$props.showPassword);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		strength,
    		validations,
    		showPassword,
    		validatePassword,
    		mouseenter_handler,
    		mouseleave_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
