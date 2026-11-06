<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';

	import { assets } from '$lib/stores/app-store';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { pushToast } from '$lib/stores/toast';
	import Modal from '$lib/components/Modal.svelte';
	import {
		getListItems,
		addMembers,
		removeMembers,
		renameMember,
		setMemberIcon,
		setMemberRarity,
		setMembersRarity,
		setMembersIcon,
		clearMemberIcon,
		getIconBlob,
		ICON_MAX_BYTES
	} from '$lib/helpers/dataAPI/api-rollcall';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';
	import {
		readNamesFile,
		pickNamesViaBridge,
		hasNativePicker,
		parseMembers
	} from '$lib/helpers/rollcall/import-txt';

	/**
	 * 名单编辑器（中文点名版新增功能，上游没有）
	 *
	 * 名单全部为用户自建（预置名单已移除）。支持：单条改名/设星级/换图标/删除（带确认），
	 * 多选后批量删除/批量设星级/批量设图标。
	 * 自定义名单可增删改，并支持为单条导入图标。
	 *
	 * 自定义名单的三种录入方式：
	 * 1. 批量粘贴（下方 textarea，一人一行）
	 * 2. 导入 TXT 文件（一人一行）：Electron 壳走系统原生文件对话框，
	 *    Web 走隐藏 <input type="file">，两者共用 import-txt.js 的解析与编码兜底
	 * 3. 逐条重命名 / 删除 / 换图标
	 *
	 * 隐私红线：用户导入的真实姓名只存本机 localStorage，图标 blob 只存本机 IndexedDB，
	 * 既不写进源码也不进构建产物。
	 */

	export let listId = '';

	let items = [];

	// 批量导入的多行文本
	let bulkText = '';
	// 正在重命名的条目 uid 与新名字
	let renamingUid = '';
	let renamingValue = '';

	// 图标 blob → objectURL 的缓存，避免每次渲染都重新读取 IndexedDB
	const iconUrls = new Map();

	/**
	 * 读图标并把 objectURL 挂到条目副本上，最后整体重新赋值 items。
	 *
	 * 不能像原来那样只往 Map 里塞值：Map 不是响应式的，Svelte 追踪不到它的变更，
	 * 图标是异步读出来的，读完模板也不会重绘 —— 表现为「缩略图不显示」，
	 * 批量设图标写进去了却看不见，被误判成「批量设图标无效」（2026-11-06 实测）。
	 * 原来为此准备的 iconVersion 计数器模板里从没引用过，等于白写。
	 *
	 * 用浅拷贝而不是直接改 it.iconUrl：items 来自 localStorage 的名单状态，
	 * 直接挂字段会让 blob: URL 被 JSON.stringify 持久化进存储（跨会话失效且白占体积）。
	 */
	const loadIcons = async () => {
		const next = [];
		for (const it of items) {
			let url = it.iconKey ? iconUrls.get(it.iconKey) : null;
			if (it.iconKey && !url) {
				try {
					const blob = await getIconBlob(it.iconKey);
					if (blob) {
						url = URL.createObjectURL(blob);
						iconUrls.set(it.iconKey, url);
					}
				} catch (e) {
					console.error('读取图标失败：', e);
				}
			}
			next.push({ ...it, iconUrl: url || null });
		}
		items = next;
	};

	const loadItems = async () => {
		items = getListItems(listId);
		await loadIcons();
	};

	/** 释放缓存的 objectURL 并移除缓存项，供换图标/清图标后重读新 blob */
	const releaseIconUrl = (iconKey) => {
		if (!iconKey) return;
		const url = iconUrls.get(iconKey);
		if (url) URL.revokeObjectURL(url);
		iconUrls.delete(iconKey);
	};

	onMount(loadItems);
	$: if (listId) loadItems();

	// 显示名：预置名单查语言包取中文名，自定义名单显示录入名（逻辑集中在 display.js）
	const displayName = (item) => memberDisplayName(item, $t);

	const handleBulkAdd = () => {
		// 与 TXT 导入同规则：行尾「空格 + 3/4/5」解析为星级
		const added = addMembers(listId, parseMembers(bulkText));
		if (!added) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		playSfx('click2');
		bulkText = '';
		pushToast({ message: $t('rollcall.added', { values: { count: added } }) });
		loadItems();
	};

	// ---- TXT 文件导入（一人一行）----

	// Web 通道用的隐藏 file input 引用
	let txtFileInput;
	// 是否运行在 Electron 壳内（壳内有 preload 注入的原生文件对话框桥）
	let useNativePicker = false;
	let txtImporting = false;

	onMount(() => {
		// preload 的 contextBridge 是同步注入的，但仍在 onMount 检测，
		// 避免在 SSR/prerender 阶段访问 window
		useNativePicker = hasNativePicker();
	});

	/** 把解析出的姓名写入当前名单并提示结果 */
	const applyImportedNames = (names, fileName) => {
		if (!names || !names.length) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		const added = addMembers(listId, names);
		if (!added) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		playSfx('click2');
		pushToast({
			message: $t('rollcall.txtImported', { values: { count: added, name: fileName || '' } })
		});
		loadItems();
	};

	const handleNativeImport = async () => {
		if (txtImporting) return;
		txtImporting = true;
		try {
			const res = await pickNamesViaBridge();
			if (res.canceled) return;
			if (res.error) {
				pushToast({
					message: $t('rollcall.txtReadFailed', { values: { error: res.error } }),
					type: 'error'
				});
				return;
			}
			applyImportedNames(res.members, res.fileName);
		} catch (e) {
			pushToast({
				message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }),
				type: 'error'
			});
		} finally {
			txtImporting = false;
		}
	};

	// Web 通道：隐藏 input 的 change 事件
	const handleTxtPick = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = ''; // 清空以便连续选同一个文件
		if (!file || txtImporting) return;
		txtImporting = true;
		try {
			const { members, fileName } = await readNamesFile(file);
			applyImportedNames(members, fileName);
		} catch (e) {
			pushToast({
				message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }),
				type: 'error'
			});
		} finally {
			txtImporting = false;
		}
	};

	const handleTxtImport = () => {
		playSfx();
		if (useNativePicker) return handleNativeImport();
		txtFileInput?.click();
	};

	const handleRemove = async (item) => {
		playSfx();
		// 单一删除也走确认框（用户 2026-11-05 要求）
		pendingDeleteUids = [item.uid];
	};

	// ---- 多选与批量操作（用户 2026-11-05 要求）----
	let selectedUids = new Set();
	// 待确认删除的 uid 数组；null = 无确认框
	let pendingDeleteUids = null;
	// 删除时是否连本地保存的图标一起删（默认是；取消勾选则保留图标 blob）
	let deleteWithIcons = true;
	let bulkIconInput;

	const toggleSelectUid = (uid) => {
		const next = new Set(selectedUids);
		if (next.has(uid)) next.delete(uid);
		else next.add(uid);
		selectedUids = next;
	};

	const toggleSelectAll = () => {
		selectedUids = selectedUids.size === items.length ? new Set() : new Set(items.map((i) => i.uid));
	};

	const confirmPendingDelete = async () => {
		const uids = pendingDeleteUids || [];
		pendingDeleteUids = null;
		if (!uids.length) return;
		playSfx('click2');
		const n = await removeMembers(listId, uids, !deleteWithIcons);
		if (!n) {
			pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
			return;
		}
		uids.forEach((u) => selectedUids.delete(u));
		selectedUids = new Set(selectedUids);
		await loadItems();
		pushToast({ message: $t('rollcall.membersDeleted', { values: { count: n } }) });
	};

	// 单条星级修改：rarity 传 3/4/5 或 null（再点同钮取消指定）
	const handleRarityChange = (item, rarity) => {
		playSfx('click2');
		setMemberRarity(listId, item.uid, rarity);
		loadItems();
	};

	const handleBulkRarity = (rarity) => {
		if (!selectedUids.size) return;
		playSfx('click2');
		setMembersRarity(listId, [...selectedUids], rarity);
		loadItems();
	};

	const handleBulkIconPick = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file || !selectedUids.size) return;
		if (!file.type.startsWith('image/')) {
			pushToast({ message: $t('rollcall.notAnImage'), type: 'error' });
			return;
		}
		if (file.size > ICON_MAX_BYTES) {
			pushToast({
				message: $t('rollcall.iconTooLarge', { values: { maxSize: '2MB' } }),
				type: 'error'
			});
			return;
		}
		try {
			await setMembersIcon(listId, [...selectedUids], file);
			await loadItems();
			pushToast({ message: $t('rollcall.bulkIconDone', { values: { count: selectedUids.size } }) });
		} catch (e) {
			pushToast({ message: String(e?.message || e), type: 'error' });
		}
	};

	const startRename = (item) => {
		playSfx();
		renamingUid = item.uid;
		renamingValue = item.chineseChar || item.name;
	};

	const commitRename = () => {
		if (!renamingUid) return;
		const ok = renameMember(listId, renamingUid, renamingValue);
		renamingUid = '';
		if (!ok) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		playSfx('click2');
		loadItems();
	};

	// 图标导入：每个条目一个隐藏的 file input，用 label 关联触发
	const handleIconPick = async (item, event) => {
		const file = event.target.files?.[0];
		event.target.value = ''; // 允许连续选同一个文件
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			pushToast({ message: $t('rollcall.notAnImage'), type: 'error' });
			return;
		}
		if (file.size > ICON_MAX_BYTES) {
			pushToast({
				message: $t('rollcall.iconTooLarge', { values: { maxSize: '2MB' } }),
				type: 'error'
			});
			return;
		}
		try {
			await setMemberIcon(listId, item.uid, file);
			// 换图标前先释放旧 objectURL，否则每换一次就漏一个 blob 引用
			releaseIconUrl(item.iconKey);
			await loadItems();
			pushToast({ message: $t('rollcall.setIcon') });
		} catch (e) {
			pushToast({ message: String(e?.message || e), type: 'error' });
		}
	};

	const handleClearIcon = async (item) => {
		playSfx('click2');
		await clearMemberIcon(listId, item.uid);
		releaseIconUrl(item.iconKey);
		await loadItems();
	};
</script>

<div class="editor" in:fade={{ duration: 150 }}>
	<div class="editor-head">
		<h3>
			{$t('rollcall.customList')}
			<span class="badge">{$t('rollcall.memberCount', { values: { count: items.length } })}</span>
		</h3>
	</div>

	<div class="bulk-add">
			<textarea bind:value={bulkText} placeholder={$t('rollcall.bulkPlaceholder')} rows="3"></textarea>
			<div class="bulk-actions">
				<button
					type="button"
					class="txt-import"
					class:disabled={txtImporting}
					disabled={txtImporting}
					on:click={handleTxtImport}
				>
					<i class="hsr-save"></i>
					<span>{txtImporting ? $t('rollcall.txtImporting') : $t('rollcall.importTxt')}</span>
				</button>
				<button
					type="button"
					class="txt-import primary"
					disabled={!bulkText.trim()}
					on:click={handleBulkAdd}
				>
					<i class="hsr-plus"></i>
					<span>{$t('rollcall.bulkAdd')}</span>
				</button>
			</div>
			<p class="tip">{$t('rollcall.txtTip')}</p>
		</div>

		<!-- Web 通道用的隐藏文件选择器；Electron 壳走主进程对话框，不需要它。
		     独立放置而非嵌在 label 内，避免 label 点击同时触发原生选择与 on:click 造成弹两次框 -->
		{#if !useNativePicker}
			<input
				type="file"
				accept=".txt,.csv,.md,text/plain"
				hidden
				bind:this={txtFileInput}
				on:change={handleTxtPick}
			/>
		{/if}

	{#if !items.length}
		<div class="empty">{$t('rollcall.noMembers')}</div>
	{:else}
		<!-- 多选工具栏：全选/反选清空 + 批量删除/设星级/设图标 -->
		<div class="select-bar">
			<label class="select-all">
				<input
					type="checkbox"
					checked={selectedUids.size === items.length && items.length > 0}
					on:change={toggleSelectAll}
					aria-label={$t('rollcall.selectAll')}
				/>
				<span>{$t('rollcall.selectAll')}（{selectedUids.size}/{items.length}）</span>
			</label>
			{#if selectedUids.size > 0}
				<div class="bulk-ops">
					<button type="button" class="txt-import danger" on:click={() => (pendingDeleteUids = [...selectedUids])}>
						<i class="hsr-trash"></i> {$t('rollcall.bulkDelete')}
					</button>
					<!-- 批量设星级（学原神版）：三钮直点，无需先选下拉 -->
					<span class="rarity-ops" title={$t('rollcall.bulkSetRarity')}>
						{#each [3, 4, 5] as r}
							<button type="button" class="rarity-btn" on:click={() => handleBulkRarity(r)}>
								{r}
							</button>
						{/each}
					</span>
					<button type="button" class="txt-import" on:click={() => bulkIconInput?.click()}>
						<i class="hsr-lightcone"></i> {$t('rollcall.bulkSetIcon')}
					</button>
					<input
						type="file"
						accept="image/*"
						hidden
						bind:this={bulkIconInput}
						on:change={handleBulkIconPick}
					/>
				</div>
			{/if}
		</div>
		<ul class="members">
			{#each items as item (item.uid)}
				<li class="member" class:selected={selectedUids.has(item.uid)}>
					<label class="pick">
						<input
							type="checkbox"
							checked={selectedUids.has(item.uid)}
							on:change={() => toggleSelectUid(item.uid)}
							aria-label={$t('rollcall.selectMember')}
						/>
						<span class="box"><i class="hsr-check"></i></span>
					</label>
					<span class="thumb">
						{#if item.iconUrl}
							<img src={item.iconUrl} alt={item.name} loading="lazy" />
						{:else}
							<i class="hsr-character"></i>
						{/if}
					</span>

					{#if renamingUid === item.uid}
						<!-- svelte-ignore a11y-autofocus -->
						<input
							class="rename-input"
							bind:value={renamingValue}
							autofocus
							on:blur={commitRename}
							on:keydown={(e) => {
								if (e.key === 'Enter') commitRename();
								if (e.key === 'Escape') renamingUid = '';
							}}
						/>
					{:else}
						<span class="name" title={displayName(item)}>{displayName(item)}</span>
					{/if}

					<!-- 星级显示（星数图标，按星级分色）+ 快捷改（学原神：方形圆角钮，当前高亮，再点取消） -->
					{#if item.rarity}
						<span class="rarity star{item.rarity}" title={$t('rollcall.setRarity')}>
							{#each Array(item.rarity) as _, i (i)}<i class="hsr-star"></i>{/each}
						</span>
					{/if}
					<span class="rarity-ops" title={$t('rollcall.setRarity')}>
						{#each [3, 4, 5] as r}
							<button
								type="button"
								class="rarity-btn star{r}"
								class:on={item.rarity === r}
								on:click={() => handleRarityChange(item, item.rarity === r ? null : r)}
							>
								{r}
							</button>
						{/each}
					</span>

					<span class="ops">
							<label class="icon-btn" title={$t('rollcall.setIcon')}>
								<i class="hsr-lightcone"></i>
								<input type="file" accept="image/*" hidden on:change={(e) => handleIconPick(item, e)} />
							</label>
							{#if item.iconKey}
								<button
									class="icon-btn"
									title={$t('rollcall.clearIcon')}
									aria-label={$t('rollcall.clearIcon')}
									on:click={() => handleClearIcon(item)}
								>
									<i class="hsr-close"></i>
								</button>
							{/if}
							<button
								class="icon-btn"
								title={$t('rollcall.rename')}
								aria-label={$t('rollcall.rename')}
								on:click={() => startRename(item)}
							>
								<i class="hsr-note"></i>
							</button>
							<button
								class="icon-btn danger"
								title={$t('rollcall.delete')}
								aria-label={$t('rollcall.delete')}
								on:click={() => handleRemove(item)}
							>
								<i class="hsr-trash"></i>
							</button>
						</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- 删除确认框（单一删除与批量删除共用）；勾选框决定是否连图标一起删 -->
{#if pendingDeleteUids}
	<Modal
		title={$t('rollcall.deleteMember')}
		on:cancel={() => (pendingDeleteUids = null)}
		on:confirm={confirmPendingDelete}
	>
		<div class="confirm-text">
			{$t('rollcall.deleteMemberPrompt', { values: { count: pendingDeleteUids.length } })}
		</div>
		<label class="keep-icons">
			<input type="checkbox" bind:checked={deleteWithIcons} />
			<span>{$t('rollcall.deleteWithIcons')}</span>
		</label>
	</Modal>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow-y: auto;
	}

	.editor-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h3 {
		margin: 0;
		font-size: 1.05rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.badge {
		font-size: 0.72rem;
		font-weight: 400;
		background-color: #e3a023;
		color: #fff;
		border-radius: 1rem;
		padding: 0.1rem 0.5rem;
	}

	.tip {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.55);
		margin: 0.4rem 0;
		line-height: 145%;
	}

	.bulk-add {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0.5rem 0 0.7rem;
	}

	textarea {
		width: 100%;
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.4rem 0.6rem;
		font-family: inherit;
		font-size: 0.85rem;
		resize: vertical;
		background-color: #fffdf8;
		color: #333;
	}

	textarea:focus {
		outline: none;
		border-color: #e3a023;
	}

	.bulk-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* 导入 TXT / 批量添加按钮：跟随原版皮肤的米色卡片配色，不引入新色系 */
	.txt-import {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid #cfc3ab;
		border-radius: 2rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.7);
		font-family: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.txt-import:hover:not(:disabled) {
		border-color: #e3a023;
		color: #000;
		background-color: #fff6e2;
	}

	.txt-import.primary {
		margin-left: auto;
		background-color: #e3a023;
		border-color: #e3a023;
		color: #fff;
	}

	.txt-import.primary:hover:not(:disabled) {
		background-color: #f0ad2e;
		color: #fff;
	}

	.txt-import.disabled,
	.txt-import:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.txt-import i {
		font-size: 0.9rem;
		line-height: 0;
	}

	.empty {
		text-align: center;
		color: rgba(0, 0, 0, 0.4);
		padding: 1.5rem 0;
		font-size: 0.85rem;
		line-height: 150%;
	}

	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		flex: 1;
		min-height: 0;
	}

	.member {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.4rem;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
	}

	.member.selected {
		background-color: rgba(227, 160, 35, 0.14);
	}

	/* 多选勾选框（沿用 Rollcall.svelte 的 enable 皮肤） */
	.pick {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}

	.pick input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.pick .box {
		width: 1rem;
		height: 1rem;
		border: 1px solid #b9a888;
		border-radius: 0.2rem;
		background-color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: transparent;
		font-size: 0.7rem;
		line-height: 0;
	}

	.pick input:checked + .box {
		background-color: #e3a023;
		border-color: #e3a023;
		color: #fff;
	}

	/* 多选工具栏 */
	.select-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0.5rem 0 0.3rem;
	}

	.select-all {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.82rem;
		cursor: pointer;
		color: rgba(0, 0, 0, 0.7);
	}

	.select-all input {
		width: 0.9rem;
		height: 0.9rem;
		accent-color: #e3a023;
		cursor: pointer;
	}

	.bulk-ops {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.txt-import.danger {
		border-color: #c0392b;
		color: #c0392b;
	}

	.txt-import.danger:hover:not(:disabled) {
		background-color: #c0392b;
		color: #fff;
	}

	/* 星级快捷钮（学原神版）：方形圆角，当前星级橙底白字 */
	.rarity-ops {
		display: inline-flex;
		gap: 0.25rem;
		margin-left: auto;
	}

	.rarity-btn {
		min-width: 1.3rem;
		height: 1.3rem;
		border: 1px solid #cfc3ab;
		border-radius: 0.3rem;
		background-color: #fffdf8;
		color: rgba(0, 0, 0, 0.55);
		font-size: 0.72rem;
		line-height: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.rarity-btn:hover {
		border-color: #e3a023;
	}

	.rarity-btn.on {
		border-color: #e3a023;
		background-color: #e3a023;
		color: #fff;
		font-weight: 600;
	}

	/* 星数显示：按星级分色（3 蓝 / 4 紫 / 5 金，与游戏星级配色一致） */
	.rarity {
		display: inline-flex;
		gap: 0.05rem;
		font-size: 0.7rem;
		line-height: 0;
	}

	.rarity.star3 i {
		color: #5b8fd4;
	}

	.rarity.star4 i {
		color: #b78bd0;
	}

	.rarity.star5 i {
		color: #d3a04a;
	}

	.confirm-text {
		font-size: 0.95rem;
		line-height: 1.6;
		padding: 0.5rem 0.2rem;
	}

	.keep-icons {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: rgba(0, 0, 0, 0.7);
		cursor: pointer;
		padding: 0.2rem;
		user-select: none;
	}

	.keep-icons input {
		width: 0.9rem;
		height: 0.9rem;
		accent-color: #e3a023;
		cursor: pointer;
	}

	.member:hover {
		background-color: rgba(255, 255, 255, 0.85);
	}

	.thumb {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.35rem;
		background-color: #efe7d6;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		color: rgba(0, 0, 0, 0.3);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.rename-input {
		flex: 1;
		min-width: 0;
		border: 1px solid #e3a023;
		border-radius: 0.3rem;
		padding: 0.15rem 0.4rem;
		font-size: 0.9rem;
		font-family: inherit;
		color: #333;
	}

	.rarity {
		display: inline-flex;
		flex-shrink: 0;
		line-height: 1;
	}

	.rarity i {
		font-size: 0.6rem;
		color: #d3bc8e;
	}

	.rarity.star5 i {
		color: #d3a04a;
	}
	.rarity.star4 i {
		color: #b78bd0;
	}
	.rarity.star3 i {
		color: #7fa5eb;
	}

	.ops {
		display: flex;
		gap: 0.15rem;
		flex-shrink: 0;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.member:hover .ops {
		opacity: 1;
	}

	.icon-btn {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.25rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: transparent;
		color: rgba(0, 0, 0, 0.5);
		cursor: pointer;
		font-size: 0.85rem;
		line-height: 0;
	}

	.icon-btn:hover {
		background-color: rgba(0, 0, 0, 0.08);
		color: #000;
	}

	.icon-btn.danger:hover {
		background-color: #ee6c4c;
		color: #fff;
	}

	/* 触屏没有 hover，操作按钮必须常驻可见 */
	:global(.mobile) .ops,
	:global(.mobileLandscape) .ops {
		opacity: 1;
	}
</style>
