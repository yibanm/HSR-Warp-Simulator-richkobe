<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';

	import { assets } from '$lib/stores/app-store';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { pushToast } from '$lib/stores/toast';
	import {
		rollcallStore,
		initRollcall,
		toggleSelect,
		resetPool,
		deleteList,
		getPoolStats,
		createList,
		addMembers,
		renameList
	} from '$lib/helpers/dataAPI/api-rollcall';
	import { readNamesFile, pickNamesViaBridge, hasNativePicker } from '$lib/helpers/rollcall/import-txt';

	import Modal from '$lib/components/Modal.svelte';
	import Scrollable from '$lib/components/Scrollable.svelte';
	import RollcallEditor from './_rollcall-editor.svelte';

	/**
	 * 名单管理页（中文点名版新增功能，上游没有）
	 *
	 * 上半部分：勾选启用哪些名单。可单选、可多选（多选则合并成一个池子），
	 * 也可把预置名单全部取消勾选、只用自定义名单。
	 * 下半部分：编辑选中的名单（增删条目、导入图标）。
	 *
	 * 视觉沿用菜单内其它面板的皮肤（半透明白底 + 圆角 + 原配色），不引入新色系。
	 */

	// 进入页面时初始化（读取存储、清理失效勾选），并推送首次快照。
	// 应用级 +layout.svelte 的 onMount 也调了一次，这里再调是幂等的，
	// 保证从其它入口直接进来时数据一定就绪。
	onMount(() => initRollcall());

	$: rc = $rollcallStore;
	$: lists = rc?.lists || [];
	$: selected = rc?.selected || [];

	// 名单全部为用户自建（预置名单已按用户裁定移除，与原神版 v1.0.1 一致），
	// 不再分组，平铺展示

	// 正在编辑的名单 id，默认指向第一个已勾选的名单，没有则指向第一个名单
	let editingId = '';
	$: if (!editingId || !lists.some((l) => l.id === editingId)) {
		editingId = selected[0] || lists[0]?.id || '';
	}

	// 当前池子进度（已点 / 总数）。依赖 rc 触发重算，抽卡后 refreshRollcall() 会推来新快照
	$: stats = rc ? getPoolStats() : { total: 0, remaining: 0, drawn: 0 };

	// ---- 总名单页的 TXT 导入：整份文件落成一份新名单（与原神版一致）----
	// 与编辑器内「批量添加旁的导入 TXT」区分：那里是往当前名单追加，这里是新建。
	let txtFileInput;
	let useNativePicker = false;
	let txtImporting = false;
	onMount(() => {
		// preload 的 contextBridge 同步注入，但 onMount 检测避免 SSR/prerender 触 window
		useNativePicker = hasNativePicker();
	});

	/** 把导入的条目落成一份新名单（名单名取文件名去扩展名），并跳转编辑 */
	const createListFromMembers = (members, fileName) => {
		if (!members || !members.length) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		const label = (fileName || '').replace(/\.[^.]+$/, '') || $t('rollcall.importedList');
		const id = createList(label);
		const added = addMembers(id, members);
		if (!added) {
			pushToast({ message: $t('rollcall.txtEmptyFile'), type: 'error' });
			return;
		}
		playSfx('click2');
		editingId = id;
		// 导入即启用（用户 2026-11-05 要求）：新建名单默认勾选进池，省得再点一次
		if (!selected.includes(id)) toggleSelect(id);
		pushToast({
			message: $t('rollcall.txtImported', { values: { count: added, name: fileName || '' } }),
			type: 'success'
		});
	};

	const handleNativeImportNew = async () => {
		if (txtImporting) return;
		txtImporting = true;
		try {
			const res = await pickNamesViaBridge();
			if (res.canceled) return;
			if (res.error) {
				pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: res.error } }), type: 'error' });
				return;
			}
			createListFromMembers(res.members, res.fileName);
		} catch (e) {
			pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }), type: 'error' });
		} finally {
			txtImporting = false;
		}
	};

	const handleTxtPickNew = async (event) => {
		const file = event.target.files?.[0];
		event.target.value = ''; // 清空以便连续选同一个文件
		if (!file || txtImporting) return;
		txtImporting = true;
		try {
			const { members, fileName } = await readNamesFile(file);
			createListFromMembers(members, fileName);
		} catch (e) {
			pushToast({ message: $t('rollcall.txtReadFailed', { values: { error: String(e?.message || e) } }), type: 'error' });
		} finally {
			txtImporting = false;
		}
	};

	const handleImportTxtNew = () => {
		playSfx();
		if (useNativePicker) return handleNativeImportNew();
		txtFileInput?.click();
	};

	const handleToggle = (listId) => {
		playSfx('click2');
		if (!toggleSelect(listId)) return;
		// 勾选状态变化会让池子作废，给用户一个提示，避免以为进度还在
		pushToast({ message: $t('rollcall.poolReset') });
	};

	const handleResetPool = () => {
		playSfx();
		resetPool();
		pushToast({ message: $t('rollcall.poolResetDone') });
	};

	// 删除名单的二次确认
	let listToDelete = null;
	const askDelete = (list) => {
		playSfx();
		listToDelete = list;
	};
	const confirmDelete = async () => {
		if (!listToDelete) return;
		const ok = await deleteList(listToDelete.id);
		if (ok) pushToast({ message: $t('rollcall.listDeleted') });
		else pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		listToDelete = null;
	};
	const cancelDelete = () => {
		listToDelete = null;
		playSfx('close');
	};

	const openEditor = (listId) => {
		playSfx('setting-item');
		editingId = listId;
	};

	// 新建 / 重命名名单共用一个输入弹窗：mode 为 'create' 或 'rename'
	let nameModal = null; // { mode, listId?, value }
	const openCreate = () => {
		playSfx();
		nameModal = { mode: 'create', value: '' };
	};
	const openRename = (list) => {
		playSfx();
		nameModal = { mode: 'rename', listId: list.id, value: list.label };
	};
	const cancelName = () => {
		nameModal = null;
		playSfx('close');
	};
	const confirmName = () => {
		const value = (nameModal?.value || '').trim();
		if (!value) {
			pushToast({ message: $t('rollcall.emptyInput'), type: 'error' });
			return;
		}
		if (nameModal.mode === 'create') {
			const id = createList(value);
			playSfx('click2');
			pushToast({ message: $t('rollcall.listCreated') });
			// 新建后直接打开编辑，并默认勾选，省得用户再点一次
			editingId = id;
			if (id && !selected.includes(id)) toggleSelect(id);
		} else {
			const ok = renameList(nameModal.listId, value);
			playSfx('click2');
			if (!ok) pushToast({ message: $t('rollcall.deleteFailed'), type: 'error' });
		}
		nameModal = null;
	};
</script>

{#if listToDelete}
	<Modal title={$t('rollcall.deleteList')} on:cancel={cancelDelete} on:confirm={confirmDelete}>
		<div class="confirm-text">
			{$t('rollcall.deleteListPrompt', { values: { name: listToDelete.label } })}
		</div>
	</Modal>
{/if}

{#if nameModal}
	<Modal
		title={nameModal.mode === 'create' ? $t('rollcall.newListTitle') : $t('rollcall.renameList')}
		on:cancel={cancelName}
		on:confirm={confirmName}
	>
		<div class="name-form">
			<label for="rollcall-list-name">{$t('rollcall.listNameLabel')}</label>
			<!-- svelte-ignore a11y-autofocus -->
			<input
				id="rollcall-list-name"
				type="text"
				bind:value={nameModal.value}
				placeholder={$t('rollcall.listNamePlaceholder')}
				autofocus
				on:keydown={(e) => {
					if (e.key === 'Enter') confirmName();
					if (e.key === 'Escape') cancelName();
				}}
			/>
		</div>
	</Modal>
{/if}

<div class="rollcall" in:fade={{ duration: 200 }} style="--bg:url('{$assets['menu-side-title-bg.webp']}')">
	<div class="pane">
		<Scrollable>
			<div class="pane-head">
				<h2>{$t('rollcall.selectTitle')}</h2>
				<div class="head-actions">
					<button
						type="button"
						class="action-btn"
						class:disabled={txtImporting}
						disabled={txtImporting}
						on:click={handleImportTxtNew}
					>
						<i class="hsr-save"></i> {txtImporting ? $t('rollcall.txtImporting') : $t('rollcall.importTxt')}
					</button>
					<button class="action-btn" on:click={openCreate}>
						<i class="hsr-plus"></i> {$t('rollcall.newList')}
					</button>
				</div>
			</div>
			<p class="desc">{$t('rollcall.selectDesc')}</p>

			<div class="pool-bar">
				<i class="hsr-character"></i>
				<span>{$t('rollcall.poolStat', { values: { remaining: stats.drawn, total: stats.total } })}</span>
				<button class="link-btn" on:click={handleResetPool}>{$t('rollcall.resetPool')}</button>
			</div>

			{#if !lists.length}
				<div class="empty">{$t('rollcall.noLists')}</div>
			{:else}
				<ul class="list-group">
					{#each lists as list (list.id)}
						<li class="list-row" class:editing={editingId === list.id}>
							<button type="button" class="row-main" on:click={() => openEditor(list.id)}>
								<span class="label">
									{list.label}
								</span>
								<span class="count">
									{$t('rollcall.memberCount', { values: { count: list.count } })}
								</span>
							</button>

							<div class="row-side">
								<label class="enable" title={$t('rollcall.enable')}>
									<input
										type="checkbox"
										checked={selected.includes(list.id)}
										on:change={() => handleToggle(list.id)}
										aria-label={$t('rollcall.enable')}
									/>
									<span class="box"><i class="hsr-check"></i></span>
									<span class="enable-text">{$t('rollcall.enable')}</span>
								</label>

								<button
									class="icon-btn"
									title={$t('rollcall.renameList')}
									aria-label={$t('rollcall.renameList')}
									on:click={() => openRename(list)}
								>
									<i class="hsr-note"></i>
								</button>
								<button
									class="icon-btn danger"
									title={$t('rollcall.deleteList')}
									aria-label={$t('rollcall.deleteList')}
									on:click={() => askDelete(list)}
								>
									<i class="hsr-trash"></i>
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Scrollable>

		<!-- 总名单页导入用的隐藏文件选择器；Electron 壳走主进程对话框，不需要它 -->
		{#if !useNativePicker}
			<input
				type="file"
				accept=".txt,.csv,.md,text/plain"
				hidden
				bind:this={txtFileInput}
				on:change={handleTxtPickNew}
			/>
		{/if}
	</div>

	<div class="pane editor-pane">
		{#if editingId}
			<RollcallEditor listId={editingId} />
		{:else}
			<div class="empty">{$t('rollcall.pickListToEdit')}</div>
		{/if}
	</div>
</div>

<style>
	.rollcall {
		width: 100%;
		height: 100%;
		display: flex;
		gap: 1rem;
		color: #333;
		overflow: hidden;
	}

	.pane {
		flex: 1;
		min-width: 0;
		background-color: rgba(255, 255, 255, 0.82);
		border-radius: 0.5rem;
		padding: 0.8rem 1rem;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.editor-pane {
		flex: 1.1;
	}

	:global(.mobileLandscape) .rollcall {
		flex-direction: column;
	}

	h2 {
		margin: 0 0 0.3rem;
		font-size: 1.3rem;
	}

	.pane-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	/* 头部两个按钮（导入 TXT / 新建名单）并排，窄屏也不挤散 */
	.head-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.action-btn.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		background-color: #fff;
		border: 1px solid #c9b58d;
		border-radius: 2rem;
		padding: 0.25rem 0.9rem;
		font-size: 0.82rem;
		color: #4a3b2a;
		white-space: nowrap;
	}

	.action-btn:hover {
		background-color: #fff6e2;
		border-color: #e3a023;
	}

	.name-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}

	.name-form label {
		font-size: 0.9rem;
		color: rgba(0, 0, 0, 0.7);
	}

	.name-form input {
		border: 1px solid #cfc3ab;
		border-radius: 0.4rem;
		padding: 0.45rem 0.7rem;
		font-size: 0.95rem;
		font-family: inherit;
		background-color: #fffdf8;
		color: #333;
	}

	.name-form input:focus {
		outline: none;
		border-color: #e3a023;
	}

	.confirm-text {
		text-align: center;
		font-size: 0.95rem;
		padding: 0.5rem 0;
		line-height: 150%;
	}

	.desc {
		margin: 0 0 0.7rem;
		font-size: 0.82rem;
		color: rgba(0, 0, 0, 0.6);
		line-height: 145%;
	}

	.pool-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background-color: #efe7d6;
		border-radius: 2rem;
		padding: 0.35rem 0.9rem;
		font-size: 0.85rem;
		margin-bottom: 0.8rem;
	}

	.pool-bar i {
		color: #9d8563;
		font-size: 1rem;
	}

	.link-btn {
		margin-left: auto;
		color: #127399;
		font-size: 0.8rem;
		text-decoration: underline;
		background: none;
		white-space: nowrap;
	}

	.empty {
		text-align: center;
		color: rgba(0, 0, 0, 0.45);
		padding: 2rem 0;
		font-size: 0.9rem;
	}

	.list-group {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.list-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.45rem 0.6rem;
		border-radius: 0.4rem;
		transition: background-color 0.15s;
	}

	.list-row:hover {
		background-color: rgba(255, 255, 255, 0.85);
	}

	.list-row.editing {
		background-color: #fff6e2;
		box-shadow: inset 0 0 0 1px #e3c68a;
	}

	.row-main {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		cursor: pointer;
		min-width: 0;
		/* 从 div 改成 button 以消除「可点击元素缺键盘事件」的无障碍缺陷，
		   这里归零浏览器默认的按钮外观，避免破坏原皮肤 */
		flex: 1;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
	}

	.label {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		font-size: 0.75rem;
		color: rgba(0, 0, 0, 0.5);
		white-space: nowrap;
	}

	.row-side {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}

	.enable {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		color: rgba(0, 0, 0, 0.65);
		cursor: pointer;
	}

	.enable input {
		display: none;
	}

	.box {
		width: 1.05rem;
		aspect-ratio: 1/1;
		border-radius: 0.25rem;
		border: 1px solid #b9ab8c;
		background-color: #fffdf8;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		font-size: 0.75rem;
		color: transparent;
		line-height: 0;
	}

	.enable input:checked + .box {
		background-color: #e3a023;
		border-color: #e3a023;
		color: #fff;
	}

	.icon-btn {
		width: 1.7rem;
		height: 1.7rem;
		border-radius: 0.3rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: transparent;
		color: rgba(0, 0, 0, 0.55);
		font-size: 0.9rem;
		line-height: 0;
		transition: all 0.15s;
	}

	.icon-btn:hover {
		background-color: rgba(0, 0, 0, 0.07);
		color: #000;
	}

	.icon-btn.danger:hover {
		background-color: #ee6c4c;
		color: #fff;
	}

	:global(.mobileLandscape) .enable-text {
		display: none;
	}
</style>
