<template>
    <div class="mono-game w-full h-full flex flex-col bg-gradient-to-br from-sky-50 via-amber-50 to-pink-50 overflow-y-auto overflow-x-hidden relative">
        <!-- 背景漂浮粒子（Three.js，置于最底层） -->
        <ParticleOverlay />

        <!-- 顶部 HUD -->
        <div class="game-hud relative z-20 flex items-center justify-between px-2 shrink-0">
            <button @click="confirmLeave" class="hud-btn">
                <i class="fa-solid fa-chevron-left text-lg"></i>
            </button>
            <div class="hud-title">
                <span class="hud-paw">🐾</span>
                <span>帕瓦小镇</span>
                <span class="hud-round">回合 {{ gs?.round || 1 }}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <button @click="toggleSound" class="hud-btn" :title="monopolyStore.settings.soundEnabled ? '音效：开' : '音效：关'">
                    <i class="fa-solid" :class="monopolyStore.settings.soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'"></i>
                </button>
                <button @click="toggleBgm" class="hud-btn" :title="monopolyStore.settings.bgmEnabled ? '背景音乐：开' : '背景音乐：关'">
                    <i class="fa-solid" :class="monopolyStore.settings.bgmEnabled ? 'fa-music' : 'fa-circle-pause'"></i>
                </button>
                <button @click="chatOpen = true" class="hud-btn relative">
                    <i class="fa-solid fa-comment-dots"></i>
                    <span v-if="unreadCount > 0" class="hud-badge">
                        {{ unreadCount > 99 ? '99+' : unreadCount }}
                    </span>
                </button>
                <button @click="confirmEnd" class="hud-end">结束</button>
            </div>
        </div>

        <!-- 顶部玩家栏：点击查看玩家详情 -->
        <div class="player-bar" v-if="players.length">
            <div v-for="p in players" :key="p.id"
                class="player-item"
                :class="{ active: p.id === currentPlayer?.id, bankrupt: p.bankrupt }"
                @click="selectedPlayer = p">
                <div class="pi-avatar">
                    <img v-if="isImg(getCharacterOf(p)?.fullBody)" :src="getCharacterOf(p)?.fullBody" />
                    <img v-else-if="isImg(getCharacterOf(p)?.token)" :src="getCharacterOf(p)?.token" />
                    <img v-else-if="isImg(p.avatar)" :src="p.avatar" />
                    <span v-else>{{ p.avatar }}</span>
                    <i v-if="p.bankrupt" class="pi-dead">💀</i>
                </div>
                <div class="pi-name">{{ p.name }}<em v-if="p.isUser">·你</em></div>
                <div class="pi-cash">¥{{ p.cash }}</div>
            </div>
        </div>

        <!-- 操作视觉特效层（纯视觉，不阻塞逻辑） -->
        <div class="fx-layer">
            <template v-for="fx in fxItems" :key="fx.id">
                <div v-if="fx.type === 'buy'" class="fx-coins">
                    <span class="fx-coin" v-for="n in 8" :key="n" :style="coinStyle(n)">💰</span>
                </div>
                <div v-else-if="fx.type === 'penalty'" class="fx-flash fx-flash-red"></div>
                <div v-else-if="fx.type === 'jail'" class="fx-flash fx-flash-gray"></div>
                <div v-else-if="fx.type === 'bankrupt'" class="fx-flash fx-fade-gray"><span class="fx-skull">💀</span></div>
                <div v-else-if="fx.type === 'build'" class="fx-glow" :style="glowStyle(fx.payload.tileId)"></div>
                <div v-else-if="fx.type === 'draw'" class="fx-card-fly">🎴</div>
                <div v-else-if="fx.type === 'rent'" class="fx-rent" :style="{ left: (fx.payload.from?.x || 0) + 'px', top: (fx.payload.from?.y || 0) + 'px' }">
                    <span class="fx-coin-fly" v-for="n in 6" :key="n" :style="rentCoinStyle(n)">💰</span>
                </div>
            </template>
        </div>

        <!-- 主内容区 -->
        <div class="game-body relative z-10 min-h-0 portrait:flex portrait:flex-col landscape:flex landscape:flex-row">
            <!-- 左栏：棋盘舞台 -->
            <div class="board-stage min-w-0 flex items-center justify-center p-1.5 min-h-0 overflow-hidden">
                <div class="board-table relative">
                    <!-- 底盘阴影与边框 -->
                    <div class="board-rim"></div>

                    <div ref="boardEl" class="mono-board relative w-full aspect-square rounded-2xl"
                        style="display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:2px;padding:2px;">
                        <template v-for="tile in BOARD" :key="tile.id">
                            <div class="tile" :class="['t-' + tile.type, { owned: !!tileOwner(tile.id), sel: selectedTile === tile.id }]"
                                :style="gridStyle(tile.id)"
                                @click="onTileClick(tile)">
                                <div class="tile-face">
                                    <div v-if="tile.type === 'property' && GROUPS[tile.group]" class="tile-bar"
                                        :style="{ background: GROUPS[tile.group].color }"></div>
                                    <div v-else-if="tile.type === 'station'" class="tile-bar" :style="{ background: GROUPS.station.color }"></div>
                                    <div v-else-if="tile.type === 'utility'" class="tile-bar" :style="{ background: GROUPS.utility.color }"></div>
                                    <img v-if="tile.image" :src="tile.image" class="tile-img" alt="" />
                                    <div class="tile-icon-wrap" v-else-if="tileIcon(tile)">
                                        <div class="tile-icon">{{ tileIcon(tile) }}</div>
                                    </div>
                                    <div v-if="tile.price" class="tile-price">¥{{ tile.price }}</div>
                                    <div class="tile-body">
                                        <div class="tile-name" :class="{ sm: tile.type !== 'property' && tile.type !== 'station' && tile.type !== 'utility' }">{{ tile.name }}</div>
                                    </div>
                                    <!-- 已购/已盖房标记：盖房等级>0 显示房屋图（白色圆底托+阴影，放大到 26px）；
                                         仅已购未盖房则显示小房子图标（🏠，用业主色做底托），不再只是左上角小点 -->
                                    <div v-if="houseCount(tile.id) > 0 || tileOwner(tile.id)"
                                        class="tile-house"
                                        :class="{ owned: houseCount(tile.id) === 0 && !!tileOwner(tile.id) }"
                                        :style="(houseCount(tile.id) === 0 && tileOwner(tile.id)) ? { '--owner-color': tileOwner(tile.id).color } : null">
                                        <img v-if="houseCount(tile.id) > 0 && HOUSE_LEVELS[houseCount(tile.id)]?.image" :src="HOUSE_LEVELS[houseCount(tile.id)].image" class="tile-house-img" alt="" />
                                        <span v-else-if="houseCount(tile.id) > 0">{{ houseLevelIcon(tile.id) }}</span>
                                        <span v-else class="tile-house-owned">🏠</span>
                                        <span v-if="houseCount(tile.id) > 0" class="tile-house-badge">{{ houseCount(tile.id) }}</span>
                                    </div>
                                    <div v-if="tileOwner(tile.id)" class="tile-owner" :style="{ background: tileOwner(tile.id)?.color }"></div>
                                </div>
                                <!-- 2.5D 厚度面 -->
                                <div class="tile-side tile-side-b"></div>
                                <div class="tile-side tile-side-r"></div>
                            </div>
                        </template>

                        <!-- 玩家棋子（站立式） -->
                        <div v-for="(p, idx) in players" :key="'tok' + p.id"
                            class="token" :style="tokenStyle(p, idx)"
                            :class="{ active: p.id === currentPlayer?.id, bankrupt: p.bankrupt }">
                            <div class="token-base" :style="{ background: p.color }"></div>
                            <div class="token-stand">
                                <img v-if="isImg(getCharacterOf(p)?.fullBody)" :src="getCharacterOf(p)?.fullBody" />
                                <img v-else-if="isImg(getCharacterOf(p)?.token)" :src="getCharacterOf(p)?.token" />
                                <img v-else-if="isImg(p.avatar)" :src="p.avatar" />
                                <span v-else>{{ p.avatar }}</span>
                            </div>
                            <i v-if="p.bankrupt" class="tok-dead">💀</i>
                        </div>

                        <!-- 棋盘中央镇中心广场 / 掷骰演出区（始终占位，避免布局抖动） -->
                        <div class="board-center-scene">
                            <!-- 掷骰演出：仅 dice 态，嵌入棋盘中央四方格，不遮挡路径 -->
                            <Dice3D v-if="gs?.phase === 'dice'" :d1="gs.dice?.[0] || 1" :d2="gs.dice?.[1] || 1"
                                :player-name="currentPlayer?.name || ''" @done="monopolyStore.finishDiceRoll()" />

                            <!-- 落点/点击地块立绘：lastLandedTile 存在且非骰子态时，中央直接显示该地块完整立绘 + 详情，替换角色立绘 -->
                            <Transition name="fade">
                                <div v-if="lastLandedTile && gs?.phase !== 'dice'" class="center-tile-view" :key="'tile-' + lastLandedTile.id">
                                    <button class="center-tile-close" @click="clearLanded()" aria-label="关闭">✕</button>
                                    <img v-if="isImg(lastLandedTile.image)" :src="lastLandedTile.image" class="center-tile-img" alt="" />
                                    <div class="center-tile-info">
                                        <div class="center-tile-name">{{ lastLandedTile.name }}</div>
                                        <div v-if="tileDetailText(lastLandedTile)" class="center-tile-detail">{{ tileDetailText(lastLandedTile) }}</div>
                                    </div>
                                </div>
                            </Transition>

                            <!-- 非掷骰、且无展示地块时：镇中心广场（当前玩家立绘 + 名字 + 骰子结果） -->
                            <div v-if="gs?.phase !== 'dice' && !lastLandedTile" class="center-plaza">
                                <div class="plaza-ring"></div>
                                <div class="plaza-floor"></div>
                                <img v-if="currentPlayer && isImg(getCharacterOf(currentPlayer)?.fullBody)" :src="getCharacterOf(currentPlayer).fullBody" class="center-char" alt="" />
                                <div class="center-namewrap">
                                    <div class="center-name">
                                        <span>{{ currentPlayer?.name || '—' }}</span>
                                        <span v-if="currentPlayer?.isUser" class="center-you">你</span>
                                    </div>
                                    <div v-if="gs?.dice && gs.dice[0]" class="center-dice">
                                        <span class="cd-pip">{{ gs.dice[0] }}</span>
                                        <span class="cd-plus">+</span>
                                        <span class="cd-pip">{{ gs.dice[1] }}</span>
                                        <span class="cd-eq">=</span>
                                        <span class="cd-total">{{ gs.dice[0] + gs.dice[1] }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 操作气泡层（棋盘中央逐个飘出，排队不冲突） -->
                    <div class="action-bubble-layer">
                        <Transition name="bubble">
                            <div v-if="currentBubble" class="action-bubble" :class="'kind-' + currentBubble.kind"
                                :style="{ '--bub-color': currentBubble.color }" :key="currentBubble.id">
                                <span class="ab-icon">{{ currentBubble.icon }}</span>
                                <span class="ab-text">{{ currentBubble.text }}</span>
                            </div>
                        </Transition>
                    </div>
                </div>
            </div>

            <!-- 右/下栏：信息面板 -->
            <div class="side-col flex-1 min-w-0 flex flex-col gap-2 p-2 portrait:flex-none landscape:overflow-y-auto landscape:min-h-0">

                <!-- AI 思考气泡 -->
                <Transition name="fade">
                    <div v-if="gs?.aiThinking && currentPlayer?.isAI" class="think-bubble">
                        <span class="think-emoji">{{ getCharacterOf(currentPlayer)?.emoji }}</span>
                        <span class="think-text">{{ gs.aiThinking.text }}</span>
                    </div>
                </Transition>

                <!-- 角色卡 -->
                <div class="hero-card">
                    <div class="hero-left">
                        <div class="hero-avatar">
                            <img v-if="isImg(getCharacterOf(currentPlayer)?.fullBody)" :src="getCharacterOf(currentPlayer).fullBody" />
                            <img v-else-if="isImg(getCharacterOf(currentPlayer)?.avatar)" :src="getCharacterOf(currentPlayer).avatar" />
                            <span v-else :style="{ background: currentPlayer?.color }">{{ currentPlayer?.avatar || '👤' }}</span>
                        </div>
                        <div class="hero-cash">
                            <i class="fa-solid fa-coins text-amber-500"></i>
                            <span>¥{{ currentPlayer?.cash || 0 }}</span>
                        </div>
                    </div>
                    <div class="hero-right">
                        <div class="hero-name">
                            {{ currentPlayer?.name || '—' }}
                            <span v-if="currentPlayer?.isUser" class="hero-you">你</span>
                        </div>
                        <div class="hero-species">{{ getCharacterOf(currentPlayer)?.emoji }} {{ getCharacterOf(currentPlayer)?.species }}</div>
                        <div class="hero-status">
                            <span v-if="currentPlayer?.inJail" class="status-jail">🔒 蹲寄养所</span>
                            <span v-else-if="currentPlayer?.isAI && gs?.phase === 'rolling'" class="status-thinking">💭 思考中…</span>
                            <span v-else class="status-turn">轮到行动</span>
                        </div>
                        <div class="hero-dice">
                            <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[0]) }}</div>
                            <div class="die" :class="{ rolling: gs?.phase === 'moving' }">{{ diceFace(gs?.dice?.[1]) }}</div>
                        </div>
                    </div>
                </div>

                <!-- 选中地块详情卡 -->
                <div v-if="selectedTileObj" class="tile-card">
                    <img v-if="selectedTileObj.image" :src="selectedTileObj.image" class="tile-card-img" alt="" />
                    <div class="tile-card-body">
                        <div class="tile-card-name">
                            {{ selectedTileObj.name }}
                            <span v-if="selectedTileObj.type === 'property'" class="dot" :style="{ background: GROUPS[selectedTileObj.group]?.color }"></span>
                        </div>
                        <div class="tile-card-line" v-if="selectedTileObj.type === 'property'">
                            价格 ¥{{ selectedTileObj.price }} · 基础租金 ¥{{ baseRentOf(selectedTileObj) }}
                        </div>
                        <div class="tile-card-line" v-else-if="selectedTileObj.type === 'station'">
                            价格 ¥{{ selectedTileObj.price }} · 车站 · 持有 {{ selectedStationOwned }} 个过路费：¥250/¥500/¥1000/¥2000
                        </div>
                        <div class="tile-card-line" v-else-if="selectedTileObj.type === 'utility'">
                            价格 ¥{{ selectedTileObj.price }} · 水电 · 掷骰点数 × 40（1 个）/ × 80（2 个）
                        </div>
                        <div class="tile-card-line" v-if="selectedOwner">
                            地主：{{ selectedOwner.name }}（{{ houseLevelName(selectedTileObj.id) }}）
                        </div>
                        <div class="tile-card-line" v-else-if="selectedTileObj.desc">{{ selectedTileObj.desc }}</div>
                    </div>
                </div>

                <!-- 操作按钮区 -->
                <div class="action-deck">
                    <div v-if="isUserTurn && gs?.phase === 'rolling' && currentPlayer?.inJail" class="flex gap-2">
                        <button @click="monopolyStore.jailUseCard()" :disabled="!currentPlayer.getOutCards" class="game-btn sky flex-1 text-sm">用出狱卡 ({{ currentPlayer.getOutCards }})</button>
                        <button @click="monopolyStore.jailPay()" :disabled="currentPlayer.cash < GET_OUT_FEE" class="game-btn green flex-1 text-sm">保释 ¥{{ GET_OUT_FEE }}</button>
                        <button @click="monopolyStore.jailRoll()" class="game-btn yellow flex-1 text-sm">掷骰出狱</button>
                    </div>
                    <button v-else-if="isUserTurn && gs?.phase === 'rolling'" @click="monopolyStore.rollDice()"
                        class="game-btn roll-btn w-full">
                        <i class="fa-solid fa-dice mr-2"></i>掷骰子
                    </button>
                    <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingBuy != null" class="flex gap-2">
                        <button @click="monopolyStore.buyProperty(gs.awaitingBuy)" :disabled="currentPlayer.cash < buyTile.price"
                            class="game-btn green flex-1">买下 ¥{{ buyTile.price }}</button>
                        <button @click="monopolyStore.skipBuy()" class="game-btn gray flex-1">放弃</button>
                    </div>
                    <div v-else-if="isUserTurn && gs?.phase === 'action' && gs?.awaitingEnd && gs?.awaitingBuy == null" class="flex gap-2">
                        <button v-if="gs?.awaitingReroll" @click="monopolyStore.userReroll()" class="game-btn blue flex-1">🎲 再掷一次</button>
                        <button @click="monopolyStore.userEndTurn()" class="game-btn yellow flex-1">结束回合</button>
                    </div>
                    <div v-else class="waiting-text">
                        <span v-if="gs?.phase === 'moving'">🐾 移动中…</span>
                        <span v-else-if="currentPlayer?.isAI">{{ currentPlayer?.name }} 正在行动…</span>
                        <span v-else>等待…</span>
                    </div>

                    <!-- 盖房面板 -->
                    <div v-if="isUserTurn && userBuildList.length" class="build-section">
                        <div class="build-title">🏗️ 可升级地产</div>
                        <div class="build-scroll">
                            <button v-for="b in userBuildList" :key="b.id" @click="monopolyStore.buildHouse(b.id)"
                                :disabled="currentPlayer.cash < b.cost || b.houses >= 5"
                                class="build-chip" :class="{ full: b.houses >= 5 }">
                                <img v-if="HOUSE_LEVELS[b.houses + 1]?.image" :src="HOUSE_LEVELS[b.houses + 1].image" class="build-chip-img" alt="" />
                                <span v-else>{{ houseLevelShort(b.houses + 1) }}</span>
                                <span class="truncate max-w-[60px]">{{ b.name }}</span>
                                <span class="text-[10px] text-sky-600">¥{{ b.cost }}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 玩家手牌区 -->
                <div v-if="currentPlayer?.isUser && userCards.length" class="card-hand">
                    <div class="card-hand-title">🎴 我的道具卡（{{ userCards.length }}/5）</div>
                    <div class="card-hand-scroll">
                        <div v-for="cardId in userCards" :key="cardId" class="mini-card"
                            :style="{ borderColor: cardTypeColor(getItemCard(cardId)?.type) }"
                            @click="onCardTap(cardId)">
                            <img v-if="getItemCard(cardId)?.image" :src="getItemCard(cardId).image" class="mini-card-img" alt="" />
                            <div class="mini-card-type" :style="{ background: cardTypeColor(getItemCard(cardId)?.type) }">
                                {{ cardTypeName(getItemCard(cardId)?.type) }}
                            </div>
                            <div class="mini-card-name">{{ getItemCard(cardId)?.name }}</div>
                        </div>
                    </div>
                </div>

                <!-- 事件日志 -->
                <div class="log-panel">
                    <div class="log-head" @click="logOpen = !logOpen">
                        <span>📜 事件日志</span>
                        <i class="fa-solid" :class="logOpen ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                    </div>
                    <div v-show="logOpen" class="log-body">
                        <div v-for="(e, i) in (gs?.log || [])" :key="i" class="log-item">{{ e.text }}</div>
                        <div v-if="!(gs?.log || []).length" class="text-gray-300 text-center mt-6">暂无事件</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 聊天面板 -->
        <Transition name="slide-right">
            <div v-if="chatOpen" class="float-chat-panel" @click.stop>
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-sky-100">
                    <h3 class="text-sky-600 text-xs font-black flex items-center gap-1.5">
                        <i class="fa-solid fa-comments"></i> 游戏聊天
                    </h3>
                    <button @click="chatOpen = false" class="fc-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div ref="chatScroll" class="flex-1 overflow-y-auto space-y-2 pr-1">
                    <div v-if="!(gs?.chat || []).length" class="text-center text-gray-300 text-[11px] py-8">暂无聊天</div>
                    <div v-for="(m, i) in (gs?.chat || [])" :key="i"
                        :class="m.role === 'system' ? 'text-center text-gray-400 text-[11px]' : (m.name === currentPlayer?.name ? 'chat-row me' : 'chat-row')">
                        <template v-if="m.role !== 'system'">
                            <div class="chat-name" :style="{ color: nameColor(m.name) }">{{ m.name }}</div>
                            <div class="chat-bubble">{{ m.content }}</div>
                        </template>
                        <template v-else>{{ m.content }}</template>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 卡牌使用动画 -->
        <Transition name="card-pop">
            <div v-if="gs?.cardAnimation" class="card-anim-overlay">
                <div class="card-anim-box" :style="{ borderColor: cardTypeColor(gs.cardAnimation.cardType) }">
                    <div class="card-anim-type" :style="{ background: cardTypeColor(gs.cardAnimation.cardType) }">
                        {{ cardTypeName(gs.cardAnimation.cardType) }}
                    </div>
                    <div class="card-anim-name">{{ gs.cardAnimation.cardName }}</div>
                    <div class="card-anim-desc">{{ gs.cardAnimation.cardDesc }}</div>
                    <div class="card-anim-player">{{ gs.cardAnimation.playerName }}</div>
                </div>
            </div>
        </Transition>

        <!-- 结束结算确认 -->
        <div v-if="showEndConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div class="bg-white rounded-2xl p-6 max-w-[300px] w-full shadow-2xl">
                <h3 class="text-lg font-bold text-center mb-4 text-gray-800">结束并结算</h3>
                <p class="text-center text-gray-600 mb-6">将按当前净资产决出冠军，确定结束？</p>
                <div class="flex gap-3">
                    <button @click="showEndConfirm = false" class="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                    <button @click="doEnd" class="flex-1 py-2.5 bg-sky-500 text-white rounded-xl font-bold text-sm">结算</button>
                </div>
            </div>
        </div>

        <!-- 胜利结算 -->
        <Transition name="fade">
            <div v-if="gs?.phase === 'ended'" class="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
                <div class="result-card">
                    <div class="result-crown">🏆</div>
                    <h2 class="result-winner">
                        {{ winner ? winner.name + (winner.isUser ? '（你）' : '') : '无人' }} 获胜！
                    </h2>
                    <div class="result-species">
                        {{ winner ? getCharacterOf(winner)?.species : '' }} · 净资产 ¥{{ winner ? netWorth(winner) : 0 }}
                    </div>
                    <div class="result-list">
                        <div v-for="(p, i) in ranking" :key="p.id" class="result-row">
                            <span class="result-rank">{{ i + 1 }}</span>
                            <span class="result-name">{{ getCharacterOf(p)?.emoji }} {{ p.name }}
                                <span v-if="p.isUser" class="result-you">你</span>
                            </span>
                            <span :class="p.bankrupt ? 'text-red-400' : 'result-worth'">{{ p.bankrupt ? '💥出局' : '¥' + netWorth(p) }}</span>
                        </div>
                    </div>
                    <button @click="backToLobby" class="result-btn">返回大厅</button>
                </div>
            </div>
        </Transition>

        <!-- 道具卡使用确认弹窗 -->
        <div v-if="cardToUse" class="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl p-5 max-w-[360px] w-full max-h-[85vh] overflow-y-auto shadow-2xl">
                <div class="text-center mb-3">
                    <div class="inline-block px-3 py-1 rounded-full text-white text-xs font-bold mb-2"
                        :style="{ background: cardTypeColor(getItemCard(cardToUse)?.type) }">
                        {{ cardTypeName(getItemCard(cardToUse)?.type) }}
                    </div>
                    <img v-if="getItemCard(cardToUse)?.image" :src="getItemCard(cardToUse).image" class="card-pop-img" :class="{ 'card-burst': cardBursting }" alt="" />
                    <h3 class="text-xl font-bold text-gray-800">{{ getItemCard(cardToUse)?.name }}</h3>
                    <p class="text-sm text-gray-500 mt-1">{{ getItemCard(cardToUse)?.desc }}</p>
                </div>
                <div v-if="isForceDice(getItemCard(cardToUse))" class="mb-3">
                    <div class="text-xs text-gray-400 mb-2 text-center">指定掷出点数：</div>
                    <div class="flex justify-center gap-2">
                        <button v-for="n in 6" :key="n" @click="selectedDiceValue = n"
                            class="w-10 h-10 rounded-lg text-lg font-bold border"
                            :class="selectedDiceValue === n ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-gray-600 border-gray-200'">
                            {{ n }}
                        </button>
                    </div>
                </div>
                <div v-else-if="needsTarget(getItemCard(cardToUse))" class="mb-3">
                    <div class="text-xs text-gray-400 mb-2 text-center">选择目标：</div>
                    <div v-if="cardTargets.length === 0" class="text-center text-gray-400 text-xs py-3">
                        没有可被使用的目标地点
                    </div>
                    <div v-else class="max-h-[150px] overflow-y-auto space-y-1">
                        <button v-for="t in cardTargets" :key="t.id" @click="selectedTarget = t.id"
                            class="w-full py-2 px-3 rounded-lg text-sm flex items-center justify-between"
                            :class="selectedTarget === t.id ? 'bg-sky-100 border-2 border-sky-400' : 'bg-gray-50 border border-gray-200'">
                            <span>{{ t.name }}</span>
                            <span class="text-xs text-gray-400">{{ t.sub }}</span>
                        </button>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button @click="cardToUse = null; selectedTarget = null; selectedDiceValue = null" class="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">取消</button>
                    <button @click="confirmUseCard" :disabled="!canUseCard || cardBursting" class="flex-1 py-3 bg-sky-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">使用</button>
                </div>
            </div>
        </div>

        <!-- 玩家详情弹层 -->
        <div v-if="selectedPlayer" class="pd-mask" @click="selectedPlayer = null">
            <div class="pd-modal" @click.stop>
                <button class="pd-close" @click="selectedPlayer = null" aria-label="关闭">✕</button>
                <div class="pd-head">
                    <div class="pd-portrait">
                        <img v-if="isImg(getCharacterOf(selectedPlayer)?.fullBody)" :src="getCharacterOf(selectedPlayer)?.fullBody" />
                        <img v-else-if="isImg(getCharacterOf(selectedPlayer)?.token)" :src="getCharacterOf(selectedPlayer)?.token" />
                        <img v-else-if="isImg(selectedPlayer.avatar)" :src="selectedPlayer.avatar" />
                        <span v-else>{{ selectedPlayer.avatar }}</span>
                    </div>
                    <div class="pd-id">
                        <div class="pd-name">{{ selectedPlayer.name }}
                            <span v-if="selectedPlayer.isUser" class="pd-you">你</span>
                        </div>
                        <div class="pd-species">{{ getCharacterOf(selectedPlayer)?.emoji }} {{ getCharacterOf(selectedPlayer)?.species }} · {{ selectedPlayer.isUser ? '玩家' : 'AI' }}</div>
                        <div v-if="selectedPlayer.bankrupt" class="pd-bankrupt">💥 已破产出局</div>
                    </div>
                </div>
                <div class="pd-stats">
                    <div class="pd-stat"><span>现金</span><b>¥{{ selectedPlayer.cash }}</b></div>
                    <div class="pd-stat"><span>净资产</span><b>¥{{ netWorth(selectedPlayer) }}</b></div>
                    <div class="pd-stat"><span>所在地</span><b>{{ BOARD[selectedPlayer.position]?.name }}</b></div>
                </div>
                <div class="pd-sec">
                    <div class="pd-sec-title">🏠 拥有的地产（{{ selectedPlayer.properties.length }}）</div>
                    <div v-if="selectedPlayer.properties.length" class="pd-prop-list">
                        <div v-for="id in selectedPlayer.properties" :key="id" class="pd-prop">
                            <span class="pd-prop-dot" :style="{ background: tileById(id) ? (GROUPS[tileById(id).group]?.color || '#999') : '#999' }"></span>
                            <span class="pd-prop-name">{{ tileById(id)?.name }}</span>
                            <span class="pd-prop-lvl">{{ houseLevelName(id) }}</span>
                        </div>
                    </div>
                    <div v-else class="pd-empty">暂无地产</div>
                </div>
                <div class="pd-sec">
                    <div class="pd-sec-title">🎴 道具卡（{{ selectedPlayer.itemCards.length }}/5）</div>
                    <div v-if="selectedPlayer.itemCards.length" class="pd-card-list">
                        <div v-for="cid in selectedPlayer.itemCards" :key="cid" class="pd-card">
                            <img v-if="getItemCard(cid)?.image" :src="getItemCard(cid).image" class="pd-card-img" />
                            <span v-else class="pd-card-ico">🎴</span>
                            <span class="pd-card-name">{{ getItemCard(cid)?.name }}</span>
                        </div>
                    </div>
                    <div v-else class="pd-empty">暂无道具卡</div>
                </div>
                <div class="pd-sec">
                    <div class="pd-sec-title">✨ 生效中效果</div>
                    <div v-if="selectedPlayerEffects.length" class="pd-eff-list">
                        <span v-for="e in selectedPlayerEffects" :key="e.key" class="pd-eff">{{ e.name }}</span>
                    </div>
                    <div v-else class="pd-empty">无</div>
                </div>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMonopolyStore } from '../../stores/monopolyStore.js'
import {
    BOARD, GROUPS, baseRentOf, houseCostOf, GO_SALARY, MAX_HOUSES, GET_OUT_FEE,
    BOARD_SIZE, HOUSE_LEVELS,
} from '../../utils/monopoly/monopolyBoard.js'
import { getCharacter } from '../../utils/monopoly/characters.js'
import { getItemCard, ITEM_CARD_TYPES } from '../../utils/monopoly/itemCards.js'
import Dice3D from '../../components/monopoly/Dice3D.vue'
import ParticleOverlay from '../../components/monopoly/ParticleOverlay.vue'
import { playSound, startBGM, stopBGM, unlockAudio } from '../../utils/monopoly/monopolySounds.js'

const router = useRouter()
const monopolyStore = useMonopolyStore()

// 通用等待 helper（AI/操作节奏控制，让用户看清动画与决策）
const sleep = ms => new Promise(r => setTimeout(r, ms))

if (!monopolyStore.currentRoom || !monopolyStore.gameState) {
    monopolyStore.loadState()
}
if (!monopolyStore.currentRoom || !monopolyStore.gameState || monopolyStore.gameState.phase === 'ended') {
    router.replace('/games/monopoly-lobby')
}

const boardEl = ref(null)
const selectedTile = ref(null)
const showEndConfirm = ref(false)
const cardToUse = ref(null)
const selectedTarget = ref(null)
const selectedDiceValue = ref(null)
const cardBursting = ref(false)
const logOpen = ref(true)
// 顶部玩家栏点击选中的玩家（详情弹层）
const selectedPlayer = ref(null)
// 操作视觉特效层（纯视觉，不阻塞逻辑）
const fxItems = ref([])
const fxShake = ref(false)

// 悬浮聊天
const chatOpen = ref(false)
const unreadCount = ref(0)
const chatScroll = ref(null)
let lastChatLen = 0

// 操作气泡（棋盘中央逐个飘出，排队不冲突）
const currentBubble = ref(null)
const bubbleQueue = []
const seenBubbleIds = new Set()
let _bubbleConsuming = false
let _bubbleTimer = null
function consumeBubbles() {
    if (_bubbleConsuming) return
    if (bubbleQueue.length === 0) { _bubbleConsuming = false; return }
    _bubbleConsuming = true
    const next = bubbleQueue.shift()
    currentBubble.value = next
    const stay = 1400 + Math.random() * 600 // 停留 1.4~2.0s，慢慢来不冲突
    _bubbleTimer = setTimeout(() => {
        currentBubble.value = null
        setTimeout(() => { _bubbleConsuming = false; consumeBubbles() }, 360) // 等出场动画结束再弹下一个
    }, stay)
}
function pushBubble(b) {
    if (seenBubbleIds.has(b.id)) return
    seenBubbleIds.add(b.id)
    bubbleQueue.push(b)
    consumeBubbles()
}

// 音效 / BGM
let booted = false
let lastLogLen = 0
function tryStartBgmOnGesture() {
    unlockAudio()
    startBGM()
    window.removeEventListener('pointerdown', tryStartBgmOnGesture)
    window.removeEventListener('touchend', tryStartBgmOnGesture)
    window.removeEventListener('keydown', tryStartBgmOnGesture)
}
function toggleSound() {
    const s = monopolyStore.settings
    s.soundEnabled = !s.soundEnabled
    if (s.soundEnabled) playSound('click')
}
function toggleBgm() {
    const s = monopolyStore.settings
    s.bgmEnabled = !s.bgmEnabled
    if (s.bgmEnabled) startBGM()
    else stopBGM()
}

// 落点地块立绘：玩家（用户或 AI）移动结束到达某地块后，中央四方格短暂显示该 tile 立绘
const lastLandedTile = ref(null)
let pendingLandPos = null
let landedTimer = null
function clearLanded() {
    if (landedTimer) { clearTimeout(landedTimer); landedTimer = null }
    lastLandedTile.value = null
}

// 点击地块时预览该地块立绘：设置 lastLandedTile 并清除自动关闭定时器，
// 让用户手动关闭（✕）或点击别处切换。不影响 selectedTile 的切换逻辑。
function previewTileArt(tile) {
    if (!tile) return
    if (landedTimer) { clearTimeout(landedTimer); landedTimer = null }
    lastLandedTile.value = tile
}
function onTileClick(tile) {
    // 保留原有选中逻辑（切换底部详情卡）
    selectedTile.value = (selectedTile.value === tile.id ? null : tile.id)
    // 同时预览该地块立绘
    previewTileArt(tile)
}

const gs = computed(() => monopolyStore.gameState)
const room = computed(() => monopolyStore.currentRoom)
const players = computed(() => gs.value?.players || [])
const currentPlayer = computed(() => monopolyStore.currentPlayer)
const isUserTurn = computed(() => monopolyStore.isUserTurn)
const buyTile = computed(() => gs.value?.awaitingBuy != null ? monopolyStore.tileById(gs.value.awaitingBuy) : null)
const selectedTileObj = computed(() => selectedTile.value != null ? monopolyStore.tileById(selectedTile.value) : null)
const selectedOwner = computed(() => selectedTileObj.value ? monopolyStore.ownerOf(selectedTileObj.value.id) : null)
// 车站详情卡：当前地主持有的车站数量（决定过路费档位）
const selectedStationOwned = computed(() => {
    if (!selectedTileObj.value || selectedTileObj.value.type !== 'station') return 0
    const o = selectedOwner.value
    if (!o) return 0
    return BOARD.filter(t => t.type === 'station' && monopolyStore.ownerOf(t.id)?.id === o.id).length
})

// 玩家详情弹层：生效中的效果（过滤掉 false/0/null/内部 _ 字段，映射友好名称）
const EFFECT_FRIENDLY = {
    shield: '租金护盾', halfRent: '租金减半', noRent: '过路免租',
    doubleRentNext: '收租翻倍', rentInsurance: '收租保险', counterClaw: '反击爪',
    blockBuild: '禁盖房', blockCards: '禁道具卡', extraRoll: '额外掷骰',
    immunityJail: '免罪金牌', moveBonus: '移动加成', limitMove: '步数限制',
}
const selectedPlayerEffects = computed(() => {
    if (!selectedPlayer.value) return []
    const ae = selectedPlayer.value.activeEffects || {}
    const out = []
    for (const k in ae) {
        if (k.startsWith('_')) continue
        const v = ae[k]
        if (!v) continue
        out.push({ key: k, name: EFFECT_FRIENDLY[k] || k })
    }
    return out
})
const winner = computed(() => gs.value?.winner ? players.value.find(p => p.id === gs.value.winner) : null)
const ranking = computed(() => [...players.value].sort((a, b) => monopolyStore.netWorth(b) - monopolyStore.netWorth(a)))

const isImg = (a) => !!a && (a.startsWith('/') || a.startsWith('data:image') || a.startsWith('http'))
const tileOwner = (id) => monopolyStore.ownerOf(id)
const netWorth = (p) => monopolyStore.netWorth(p)
const houseCount = (id) => {
    const o = tileOwner(id)
    return o ? (o.houses?.[id] || 0) : 0
}
const houseLevelIcon = (id) => {
    const h = houseCount(id)
    return HOUSE_LEVELS[h]?.icon || ''
}
const houseLevelName = (id) => {
    const h = houseCount(id)
    const owner = tileOwner(id)
    if (h === 0) {
        // 有地主但 0 级：显示"未盖房"；无地主：显示"空地"
        return owner ? '未盖房（0级）' : '空地'
    }
    // 盖房后显示"等级·名称"，如"1级·小帐篷"
    return `${h}级·${HOUSE_LEVELS[h]?.name || '空地'}`
}
const houseLevelShort = (h) => {
    return HOUSE_LEVELS[h]?.icon || '⚪'
}
const getCharacterOf = (player) => {
    if (!player) return null
    return getCharacter(player.characterId)
}

// 用户手牌
const userCards = computed(() => {
    const p = currentPlayer.value
    if (!p || !p.isUser) return []
    return p.itemCards || []
})

// 道具卡目标选择
const OWNED_TYPES = ['property', 'station', 'utility']
const cardTargets = computed(() => {
    if (!cardToUse.value) return []
    const card = getItemCard(cardToUse.value)
    if (!card) return []
    if (card.targetType === 'player') {
        // 玩家目标：显示其现金（修复 ¥undefined）
        return activePlayersList.value.filter(p => !p.isUser)
            .map(p => ({ id: p.id, name: p.name, cash: p.cash, sub: '💰 ¥' + (p.cash || 0) }))
    }
    const toTarget = (t) => {
        const owner = monopolyStore.ownerOf(t.id)?.name || ''
        return {
            id: t.id, name: t.name, price: t.price, owner,
            sub: owner ? '地主 ' + owner : '¥' + t.price,
        }
    }
    if (card.targetType === 'tile') {
        // 传送卷轴等：全图可选
        return BOARD.filter(t => OWNED_TYPES.includes(t.type)).map(toTarget)
    }
    if (card.targetType === 'tile_owned_by_others') {
        // 只返回被其他玩家拥有的 property/station/utility（拆房锤等）
        const me = monopolyStore.currentPlayer
        return BOARD.filter(t => OWNED_TYPES.includes(t.type))
            .filter(t => { const o = monopolyStore.ownerOf(t.id); return o && o.id !== me?.id })
            .map(toTarget)
    }
    if (card.targetType === 'tile_owned_by_self') {
        // 只返回被当前玩家拥有的 property/station/utility
        const me = monopolyStore.currentPlayer
        return BOARD.filter(t => OWNED_TYPES.includes(t.type))
            .filter(t => { const o = monopolyStore.ownerOf(t.id); return o && o.id === me?.id })
            .map(toTarget)
    }
    return []
})
const activePlayersList = computed(() => players.value.filter(p => !p.bankrupt))
const needsTarget = (card) => card && card.targetType && card.targetType !== 'self'
const isForceDice = (card) => card?.effect?.action === 'forceDice'
const canUseCard = computed(() => {
    const card = getItemCard(cardToUse.value)
    if (!card) return false
    if (isForceDice(card)) return selectedDiceValue.value != null
    if (needsTarget(card)) return selectedTarget.value != null
    return true
})

function onCardTap(cardId) {
    const card = getItemCard(cardId)
    if (!card) return
    cardToUse.value = cardId
    selectedTarget.value = null
    selectedDiceValue.value = null
}

function confirmUseCard() {
    if (!cardToUse.value || cardBursting.value) return
    const card = getItemCard(cardToUse.value)
    if (!card) return
    const target = isForceDice(card) ? selectedDiceValue.value : selectedTarget.value
    // 先播放缩放+光晕动画，再关闭弹窗并执行卡牌效果（配合任务要求 400~600ms 等待）
    cardBursting.value = true
    setTimeout(() => {
        monopolyStore.useItemCard(cardToUse.value, target)
        cardToUse.value = null
        selectedTarget.value = null
        selectedDiceValue.value = null
        cardBursting.value = false
    }, 500)
}

function cardTypeColor(type) {
    return ITEM_CARD_TYPES[type]?.color || '#999'
}
function cardTypeName(type) {
    return ITEM_CARD_TYPES[type]?.name || ''
}

const userBuildList = computed(() => {
    const p = currentPlayer.value
    if (!p || !p.isUser) return []
    const list = []
    for (const id of p.properties) {
        const t = monopolyStore.tileById(id)
        if (t.type !== 'property') continue
        if (!monopolyStore.ownsFullGroup(p, t.group)) continue
        list.push({ id, name: t.name, houses: p.houses[id] || 0, cost: houseCostOf(t) })
    }
    return list
})

function nameColor(name) {
    const p = players.value.find(pl => pl.name === name)
    return p ? p.color : '#6b7280'
}

function tileIcon(tile) {
    return {
        go: '🐾', jail: '🏠', gotojail: '🚔', parking: '☀️', tax: '🧾', chance: '🐱', chest: '🐶',
    }[tile.type] || '🎲'
}

// 中央地块立绘底部详情：名称 + 价格/租金/功能说明
function tileDetailText(tile) {
    if (!tile) return ''
    const parts = []
    if (tile.price) parts.push('价格 ¥' + tile.price)
    if (tile.type === 'property') {
        parts.push('基础租金 ¥' + baseRentOf(tile))
    } else if (tile.type === 'station') {
        parts.push('过路费：¥250/¥500/¥1000/¥2000（随持有数递增）')
    } else if (tile.type === 'utility') {
        parts.push('过路费：骰子点数 ×40（1 个）/ ×80（2 个）')
    }
    const funcMap = {
        go: '起点 · 路过领工资', tax: '缴税点', parking: '免费停车奖池',
        jail: '探监（寄养所）', gotojail: '进入寄养所', chance: '机会卡', chest: '命运卡',
        station: '车站 · 过路费随持有数翻倍', utility: '公共设施 · 过路费随骰子点数',
    }
    if (funcMap[tile.type]) parts.push(funcMap[tile.type])
    if (tile.desc) parts.push(tile.desc)
    return parts.join(' · ')
}

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function diceFace(n) { return FACES[(n || 1) - 1] }

function gridPos(id) {
    if (id <= 10) return { c: id + 1, r: 1 }
    if (id <= 20) return { c: 11, r: id - 9 }
    if (id <= 30) return { c: 31 - id, r: 11 }
    return { c: 1, r: 41 - id }
}
function gridStyle(id) {
    const { c, r } = gridPos(id)
    return { gridColumn: c, gridRow: r }
}

const TOKEN_OFFSETS = [
    [0, 0], [-12, -12], [12, -12], [-12, 12], [12, 12], [0, -16], [0, 16], [-16, 0],
]
const displayPos = reactive({})
function syncDisplay() {
    players.value.forEach(p => { displayPos[p.id] = p.position })
}
function tokenStyle(p, idx) {
    if (!p) return {}
    const pos = displayPos[p.id] ?? p.position ?? 0
    const { c, r } = gridPos(pos)
    const left = (c - 0.5) / 11 * 100
    const top = (r - 0.5) / 11 * 100
    const off = TOKEN_OFFSETS[(idx || 0) % TOKEN_OFFSETS.length] || [0, 0]
    return {
        left: `calc(${left}% + ${off[0] || 0}px)`,
        top: `calc(${top}% + ${off[1] || 0}px)`,
    }
}

// ---- AI 自动推进 ----
let aiTimer = null
let animating = false
function scheduleAI() {
    const g = monopolyStore.gameState
    if (!g || g.phase !== 'rolling') return
    const p = monopolyStore.currentPlayer
    if (!p || !p.isAI) return
    if (aiTimer) return
    monopolyStore.setAiThinking(p.id)
    const delay = 1200 + Math.random() * 800
    aiTimer = setTimeout(() => { aiTimer = null; aiAct() }, delay)
}
async function aiAct() {
    const g = monopolyStore.gameState
    if (!g || g.phase !== 'rolling') return
    const p = monopolyStore.currentPlayer
    if (!p || !p.isAI) return
    if (p.inJail) {
        if (p.getOutCards > 0) monopolyStore.jailUseCard()
        else if (p.cash >= GET_OUT_FEE) monopolyStore.jailPay()
        else monopolyStore.jailRoll()
        if (!monopolyStore.currentPlayer?.inJail) {
            setTimeout(() => scheduleAI(), 800)
        }
        return
    }
    // AI 掷骰前停顿 800~1200ms，让用户看清
    await sleep(800 + Math.random() * 400)
    if (Math.random() < 0.3) {
        monopolyStore.aiTryUseCard(p)
    }
    monopolyStore.rollDice()
}

// 落子后把棋子显示位置对齐到真实落点
// （修正入狱/传送等被 resolveTile 二次改写 position、但 displayPos 未同步的情况）
function syncToken(pid) {
    const pl = monopolyStore.gameState?.players.find(x => x.id === pid)
    if (pl) displayPos[pid] = pl.position
}

function startMoveAnimation() {
    if (animating) return
    const g = monopolyStore.gameState
    const mv = g?.pendingMove
    if (!mv) {
        // 没有待处理移动却停在 moving：兜底直接结算，避免永久卡死
        if (g?.phase === 'moving') monopolyStore.applyMove()
        return
    }
    animating = true
    const pid = mv.playerId
    // 安全保底：动画开始后 6s 若仍停在 moving（卡住/未收尾），强制结算推进回合
    const safetyTimer = setTimeout(() => {
        const gg = monopolyStore.gameState
        if (gg && gg.phase === 'moving') monopolyStore.applyMove()
    }, 6000)
    if (!mv.path || !mv.path.length) {
        displayPos[pid] = mv.finalPos
        animating = false
        clearTimeout(safetyTimer)
        monopolyStore.applyMove()
        syncToken(pid)
        return
    }
    let i = 0
    const step = () => {
        if (i < mv.path.length) {
            displayPos[pid] = mv.path[i]
            i++
            // AI/用户移动每步等待 350~400ms，让用户看清棋子移动
            setTimeout(step, 350 + Math.random() * 50)
        } else {
            displayPos[pid] = mv.finalPos
            animating = false
            clearTimeout(safetyTimer)
            setTimeout(() => { monopolyStore.applyMove(); syncToken(pid) }, 600)
        }
    }
    step()
}

watch(() => monopolyStore.gameState?.phase, (np, op) => {
    if (np === 'moving') {
        nextTick(startMoveAnimation)
        // 进入移动态时记录即将落点（pendingMove 此时已算好）
        if (monopolyStore.gameState?.pendingMove) {
            pendingLandPos = monopolyStore.gameState.pendingMove.finalPos
        }
    }
    // 移动结束（离开 moving，进入 action 或下一玩家 rolling）：短暂显示落点地块立绘
    if (op === 'moving' && pendingLandPos != null && np !== 'moving') {
        const t = BOARD[pendingLandPos]
        pendingLandPos = null
        if (t) {
            // 落点立绘显示前等待 300~500ms，让用户看清落点
            setTimeout(() => {
                lastLandedTile.value = t
                if (landedTimer) clearTimeout(landedTimer)
                landedTimer = setTimeout(() => { lastLandedTile.value = null }, 2600)
            }, 400)
        }
    }
})

// 监听 pendingMove：卡牌/传送造成的 moveTo 常在 phase 已为 'moving' 时再次写入 pendingMove，
// 此时 phase 不变化、上面的 phase watch 不会触发，这里补触发移动动画，避免棋子不动/卡死。
watch(() => monopolyStore.gameState?.pendingMove, (nm) => {
    if (nm && monopolyStore.gameState?.phase === 'moving') {
        nextTick(startMoveAnimation)
    }
})

watch(() => [monopolyStore.gameState?.phase, monopolyStore.gameState?.currentTurn], () => {
    scheduleAI()
})

// ===== 音效触发（掷骰 / 结算）=====
watch(() => monopolyStore.gameState?.phase, (np) => {
    if (np === 'dice') playSound('rollDice')
    if (np === 'ended') {
        stopBGM()
        playSound(winner.value?.isUser ? 'win' : 'lose')
    }
})

// ===== 音效触发（买地 / 付租 / 盖房 / 抽卡，扫描事件日志，用户与 AI 通用）=====
watch(() => gs.value?.log?.length, (n) => {
    const len = n || 0
    if (len > lastLogLen) {
        const log = gs.value?.log || []
        for (let i = lastLogLen; i < len; i++) {
            const txt = log[i]?.text || ''
            if (txt.includes('租金') || txt.includes('付租')) playSound('rent')
            else if (txt.includes('买下')) playSound('buy')
            else if (txt.includes('升级为') || txt.includes('盖房')) playSound('build')
            else if (txt.includes('抽到') || txt.includes('获得道具卡')) playSound('drawCard')
        }
    }
    lastLogLen = len
})

// ===== 操作视觉特效（纯视觉，不阻塞逻辑）=====
// 监听事件日志，按关键词分类触发 CSS 动画；fxQueue 逐个播放，1.5s 后自动移除。
let _fxSeq = 0
let _lastFxLen = 0
let _fxShakeTimer = null
function classifyFx(text) {
    if (text.includes('买下')) return 'buy'
    if (text.includes('陷阱') || text.includes('罚款') || text.includes('赔钱')) return 'penalty'
    if (text.includes('寄养所') || text.includes('进监狱')) return 'jail'
    if (text.includes('破产出局')) return 'bankrupt'
    if (text.includes('升级为') || text.includes('盖房')) return 'build'
    if (text.includes('抽到')) return 'draw'
    if (text.includes('租金')) return 'rent'
    return null
}
// 棋子棋盘坐标 -> 屏幕坐标（viewport 相对）
function tokenScreenPos(pos) {
    const el = boardEl.value
    if (!el || pos == null) return null
    const rect = el.getBoundingClientRect()
    const { c, r } = gridPos(pos)
    return {
        x: rect.left + (c - 0.5) / 11 * rect.width,
        y: rect.top + (r - 0.5) / 11 * rect.height,
    }
}
// 地块格屏幕坐标（viewport 相对）
function tileScreenRect(tileId) {
    const el = boardEl.value
    if (!el || tileId == null) return null
    const rect = el.getBoundingClientRect()
    const { c, r } = gridPos(tileId)
    const w = rect.width / 11, h = rect.height / 11
    return { left: rect.left + (c - 1) * w, top: rect.top + (r - 1) * h, width: w, height: h }
}
function spawnFx(type, payload) {
    const id = ++_fxSeq
    fxItems.value.push({ id, type, payload: payload || {} })
    if (type === 'penalty' || type === 'jail') {
        fxShake.value = true
        if (_fxShakeTimer) clearTimeout(_fxShakeTimer)
        _fxShakeTimer = setTimeout(() => { fxShake.value = false }, 420)
    }
    setTimeout(() => {
        fxItems.value = fxItems.value.filter(f => f.id !== id)
    }, 1500)
}
function coinStyle(n) {
    const left = 8 + (n * 11) + (Math.random() * 6 - 3)
    const delay = (n % 4) * 0.08 + Math.random() * 0.1
    return { left: left + '%', animationDelay: delay.toFixed(2) + 's' }
}
function rentCoinStyle(n) {
    const dx = (Math.random() * 36 - 18).toFixed(0)
    const dy = -(40 + Math.random() * 40).toFixed(0)
    return { '--dx': dx + 'px', '--dy': dy + 'px', animationDelay: (n * 0.05).toFixed(2) + 's' }
}
function glowStyle(tileId) {
    const rect = tileScreenRect(tileId)
    if (!rect) return { left: '50%', top: '50%', width: '60px', height: '60px', transform: 'translate(-50%, -50%)' }
    return { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' }
}
watch(() => gs.value?.log?.length, (n) => {
    const len = n || 0
    if (len > _lastFxLen) {
        const log = gs.value?.log || []
        const start = Math.max(_lastFxLen, len > 200 ? len - 50 : 0)
        for (let i = start; i < len; i++) {
            const txt = log[i]?.text || ''
            const type = classifyFx(txt)
            if (!type) continue
            let payload = {}
            if (type === 'rent') {
                const from = tokenScreenPos(currentPlayer.value?.position)
                payload = { from }
            } else if (type === 'build') {
                const m = txt.match(/在 (.+?) 升级/)
                const name = m ? m[1] : null
                const t = name ? BOARD.find(b => b.name === name) : null
                payload = { tileId: t ? t.id : null }
            }
            spawnFx(type, payload)
        }
    }
    _lastFxLen = len
})

// 聊天未读 + 自动滚动
watch(() => gs.value?.chat?.length, (n, o) => {
    const len = n || 0
    const prev = o || lastChatLen
    lastChatLen = len
    if (len > prev && !chatOpen.value) {
        unreadCount.value += (len - prev)
    }
    if (booted && len > prev) {
        const chat = gs.value?.chat || []
        let hasNewMsg = false
        for (let i = prev; i < len; i++) {
            if (chat[i]?.role && chat[i].role !== 'system') { hasNewMsg = true; break }
        }
        if (hasNewMsg) playSound('chat')
    }
    if (chatOpen.value && chatScroll.value) {
        nextTick(() => { chatScroll.value.scrollTop = chatScroll.value.scrollHeight })
    }
})
watch(chatOpen, (v) => { if (v) { unreadCount.value = 0; nextTick(() => { if (chatScroll.value) chatScroll.value.scrollTop = chatScroll.value.scrollHeight }) } })

// 操作气泡：监听 store 事件队列，逐个飘出（store 数组只增不消费，本地去重后排队）
watch(() => monopolyStore.actionBubbles, (list) => {
    if (!list) return
    for (const b of list) pushBubble(b)
}, { deep: true })

onMounted(() => {
    if (!monopolyStore.currentRoom || !monopolyStore.gameState) {
        monopolyStore.loadState()
    }
    if (!monopolyStore.currentRoom || !monopolyStore.gameState || monopolyStore.gameState.phase === 'ended') {
        router.replace('/games/monopoly-lobby')
        return
    }
    lastLogLen = gs.value?.log?.length || 0
    syncDisplay()
    scheduleAI()
    // BGM：先尝试解锁并播放（浏览器策略可能拦截），首次用户手势再补播
    unlockAudio()
    startBGM()
    window.addEventListener('pointerdown', tryStartBgmOnGesture)
    window.addEventListener('touchend', tryStartBgmOnGesture)
    window.addEventListener('keydown', tryStartBgmOnGesture)
    nextTick(() => { booted = true })
})

onUnmounted(() => {
    stopBGM()
    if (_bubbleTimer) clearTimeout(_bubbleTimer)
    window.removeEventListener('pointerdown', tryStartBgmOnGesture)
    window.removeEventListener('touchend', tryStartBgmOnGesture)
    window.removeEventListener('keydown', tryStartBgmOnGesture)
})

function confirmEnd() {
    showEndConfirm.value = true
}
function doEnd() {
    showEndConfirm.value = false
    monopolyStore.finishGame()
}
function backToLobby() {
    monopolyStore.leaveRoom()
    router.push('/games/monopoly-lobby')
}
function confirmLeave() {
    showEndConfirm.value = false
    monopolyStore.leaveRoom()
    router.push('/games/monopoly-lobby')
}
</script>

<style scoped>
/* ===== 全局游戏感 ===== */
.mono-game {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

/* ===== 顶部 HUD ===== */
.game-hud {
    height: 40px;
    background: linear-gradient(180deg, #4aa3df 0%, #2e86c1 100%);
    border-bottom: 2px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 4px 12px rgba(46, 134, 193, 0.35);
}
.hud-btn {
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    color: #fff;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 4px rgba(0, 0, 0, 0.12);
    transition: transform 0.1s, background 0.1s;
}
.hud-btn:active { transform: scale(0.92); background: rgba(255, 255, 255, 0.28); }
.hud-title {
    display: flex; align-items: center; gap: 6px;
    color: #fff; font-weight: 900; font-size: 15px;
    text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18), 0 0 8px rgba(255, 255, 255, 0.25);
}
.hud-paw { font-size: 18px; filter: drop-shadow(0 2px 1px rgba(0,0,0,0.2)); }
.hud-round {
    font-size: 10px; font-weight: 800;
    background: rgba(255, 255, 255, 0.22);
    padding: 2px 8px; border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.25);
}
.hud-end {
    height: 30px; padding: 0 12px;
    border-radius: 999px;
    background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%);
    color: #fff; font-size: 12px; font-weight: 800;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 4px rgba(0, 0, 0, 0.18);
    transition: transform 0.1s;
}
.hud-end:active { transform: scale(0.94); }
.hud-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 16px; height: 16px; padding: 0 3px;
    background: #e74c3c; color: #fff; font-size: 9px; font-weight: 900;
    border-radius: 999px; border: 2px solid #2e86c1;
    display: flex; align-items: center; justify-content: center;
}

/* ===== 顶部玩家栏 ===== */
.player-bar {
    position: relative; z-index: 20;
    display: flex; gap: 6px;
    padding: 6px 8px;
    background: linear-gradient(180deg, #eaf6fd 0%, #d6ecfa 100%);
    border-bottom: 2px solid rgba(46, 134, 193, 0.18);
    overflow-x: auto;
    scrollbar-width: none;
}
.player-bar::-webkit-scrollbar { display: none; }
.player-item {
    flex: 0 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    padding: 4px 8px;
    border-radius: 12px;
    background: #fff;
    border: 2px solid transparent;
    box-shadow: 0 2px 5px rgba(46, 134, 193, 0.12);
    cursor: pointer;
    transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
    min-width: 56px;
}
.player-item:active { transform: translateY(2px); }
.player-item.active {
    border-color: #f4d03f;
    box-shadow: 0 0 0 2px #f4d03f, 0 3px 8px rgba(244, 208, 63, 0.35);
}
.player-item.bankrupt { filter: grayscale(0.7); opacity: 0.7; }
.pi-avatar {
    position: relative;
    width: 34px; height: 34px; border-radius: 50%;
    overflow: hidden; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%);
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}
.pi-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.pi-avatar span { font-size: 18px; }
.pi-dead { position: absolute; bottom: -2px; right: -2px; font-size: 13px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3)); }
.pi-name { font-size: 10px; font-weight: 800; color: #1a2634; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-name em { font-style: normal; font-size: 8px; color: #2e86c1; background: #d6ecfa; border-radius: 4px; padding: 0 3px; }
.pi-cash { font-size: 9px; font-weight: 900; color: #b45309; }

/* ===== 玩家详情弹层 ===== */
.pd-mask {
    position: fixed; inset: 0; z-index: 210;
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
}
.pd-modal {
    position: relative;
    width: 100%; max-width: 340px; max-height: 86vh; overflow-y: auto;
    background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
    border: 3px solid #f4d03f;
    border-radius: 22px;
    padding: 18px 16px 16px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38), inset 0 2px 0 rgba(255, 255, 255, 0.8);
    animation: pdPop 0.28s ease-out;
}
@keyframes pdPop {
    0% { transform: scale(0.82) translateY(20px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
}
.pd-close {
    position: absolute; top: 10px; right: 10px;
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(93, 173, 226, 0.45);
    color: #2e86c1; font-size: 13px; font-weight: 900;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.14);
    z-index: 4;
}
.pd-head { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.pd-portrait {
    flex: 0 0 64px; width: 64px; height: 72px; border-radius: 12px; overflow: hidden;
    background: linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%);
    border: 2.5px solid #fff; box-shadow: 0 5px 12px rgba(0, 0, 0, 0.16);
    display: flex; align-items: flex-end; justify-content: center;
}
.pd-portrait img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.pd-portrait span { font-size: 30px; padding-bottom: 4px; }
.pd-id { min-width: 0; flex: 1; }
.pd-name { font-size: 18px; font-weight: 900; color: #1a2634; display: flex; align-items: center; gap: 5px; }
.pd-you { font-size: 10px; background: #5dade2; color: #fff; border-radius: 6px; padding: 1px 5px; }
.pd-species { font-size: 11px; color: #5dade2; font-weight: 700; margin-top: 2px; }
.pd-bankrupt { display: inline-block; margin-top: 4px; font-size: 10px; font-weight: 800; color: #fff; background: #e74c3c; border-radius: 6px; padding: 1px 7px; }
.pd-stats { display: flex; gap: 6px; margin-bottom: 12px; }
.pd-stat {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 7px 4px; border-radius: 12px;
    background: #fff; border: 1.5px solid #aed6f1;
    box-shadow: 0 2px 5px rgba(46, 134, 193, 0.08);
}
.pd-stat span { font-size: 9px; color: #64748b; font-weight: 700; }
.pd-stat b { font-size: 12px; color: #1a2634; font-weight: 900; }
.pd-sec { margin-bottom: 12px; }
.pd-sec-title { font-size: 11px; font-weight: 800; color: #1a2634; margin-bottom: 6px; }
.pd-prop-list, .pd-card-list, .pd-eff-list { display: flex; flex-direction: column; gap: 5px; }
.pd-card-list { flex-direction: row; flex-wrap: wrap; gap: 6px; }
.pd-prop {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 8px; border-radius: 10px;
    background: #fff; border: 1.5px solid #e3f2fd;
    box-shadow: 0 2px 4px rgba(46, 134, 193, 0.06);
    font-size: 11px;
}
.pd-prop-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
.pd-prop-name { flex: 1; min-width: 0; font-weight: 700; color: #1a2634; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pd-prop-lvl { color: #b45309; font-weight: 800; flex: 0 0 auto; }
.pd-card {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 8px; border-radius: 10px;
    background: linear-gradient(180deg, #fff 0%, #e8f6fc 100%);
    border: 1.5px solid #aed6f1;
    font-size: 10px; font-weight: 700; color: #1f618d;
}
.pd-card-img { width: 18px; height: 22px; object-fit: cover; border-radius: 4px; }
.pd-card-ico { font-size: 14px; }
.pd-eff {
    align-self: flex-start;
    padding: 3px 10px; border-radius: 999px;
    background: linear-gradient(180deg, #fde68a 0%, #f4d03f 100%);
    color: #7a5c06; font-size: 10px; font-weight: 800;
    box-shadow: 0 2px 4px rgba(244, 208, 63, 0.3);
}
.pd-empty { font-size: 10px; color: #94a3b8; padding: 4px 2px; }

/* ===== 棋盘舞台（2.5D） ===== */
.board-stage {
    perspective: 1300px;
    perspective-origin: 50% 45%;
    padding: 1px;
}
.board-table {
    position: relative;
    width: min(100%, 520px);
    margin: 0 auto;
    transform-style: preserve-3d;
    transform: rotateX(5deg);
}
.board-rim {
    position: absolute;
    inset: -8px;
    border-radius: 22px;
    background: linear-gradient(145deg, #5dade2, #2e86c1);
    box-shadow:
        0 28px 55px rgba(0, 0, 0, 0.32),
        0 10px 20px rgba(0, 0, 0, 0.2),
        inset 0 2px 0 rgba(255, 255, 255, 0.3),
        inset 0 -4px 0 rgba(0, 0, 0, 0.12);
    transform: translateZ(-14px);
}
.mono-board {
    background:
        radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 55%),
        linear-gradient(135deg, #a8d8ea 0%, #8bcbe6 50%, #a8d8ea 100%);
    border: 2px solid #1f618d;
    border-radius: 12px;
    box-shadow:
        inset 0 0 0 2px rgba(255, 255, 255, 0.4),
        inset 0 10px 28px rgba(255, 255, 255, 0.3),
        inset 0 -10px 28px rgba(0, 0, 0, 0.08),
        0 24px 48px rgba(0, 0, 0, 0.28);
    transform-style: preserve-3d;
}

/* ===== 地块 2.5D 盒子 ===== */
.tile {
    position: relative;
    transform-style: preserve-3d;
    cursor: pointer;
    min-width: 0; min-height: 0;
    transform: translateZ(4px);
    transition: transform 0.15s;
}
.tile-face {
    position: absolute; inset: 0;
    border-radius: 5px;
    background: linear-gradient(180deg, #fefefe 0%, #e8f6fc 100%);
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.95),
        inset 0 -3px 0 rgba(174, 214, 241, 0.5),
        0 3px 0 #6baed6,
        0 6px 8px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    display: flex; flex-direction: column;
    transform: translateZ(5px);
}
.tile:active .tile-face,
.tile.sel .tile-face {
    transform: translateZ(10px);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.95),
        0 5px 0 #6baed6,
        0 0 0 2px #f4d03f,
        0 10px 16px rgba(0, 0, 0, 0.18);
}
.tile-side {
    position: absolute;
    background: #4a90b8;
    border-radius: 2px;
}
.tile-side-b {
    left: 1px; right: 1px; bottom: -6px; height: 6px;
    transform-origin: top;
    transform: rotateX(-90deg) translateZ(0px);
    background: linear-gradient(180deg, #5dade2 0%, #1f618d 100%);
    box-shadow: 0 5px 8px rgba(0,0,0,0.18);
}
.tile-side-r {
    top: 1px; bottom: 1px; right: -6px; width: 6px;
    transform-origin: left;
    transform: rotateY(90deg) translateZ(0px);
    background: linear-gradient(90deg, #5dade2 0%, #1f618d 100%);
}

/* 角格更大更厚 */
.tile.t-go .tile-face,
.tile.t-jail .tile-face,
.tile.t-gotojail .tile-face,
.tile.t-parking .tile-face {
    border-radius: 7px;
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.95),
        inset 0 -5px 0 rgba(174, 214, 241, 0.55),
        0 4px 0 #5da1c9,
        0 8px 12px rgba(0, 0, 0, 0.16);
}
.tile.t-go .tile-face { background: linear-gradient(180deg, #fef9e7 0%, #fde68a 100%); }
.tile.t-jail .tile-face, .tile.t-gotojail .tile-face { background: linear-gradient(180deg, #fee2e2 0%, #fecaca 100%); }
.tile.t-parking .tile-face { background: linear-gradient(180deg, #dcfce7 0%, #bbf7d0 100%); }
.tile.t-chance .tile-face { background: linear-gradient(180deg, #dbeafe 0%, #bfdbfe 100%); }
.tile.t-chest .tile-face { background: linear-gradient(180deg, #fef3c7 0%, #fde68a 100%); }
.tile.t-tax .tile-face { background: linear-gradient(180deg, #ffedd5 0%, #fed7aa 100%); }

.tile-img {
    position: absolute; top: 16%; left: 6%;
    width: 88%; height: 62%;
    object-fit: contain; z-index: 1;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.14));
    pointer-events: none;
}
.tile-bar {
    position: relative; z-index: 2;
    height: 18%; width: 100%;
    box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.08);
    border-radius: 4px 4px 0 0;
}
.tile-icon-wrap {
    position: absolute; top: 18%; left: 0; right: 0; bottom: 32%;
    display: flex; align-items: center; justify-content: center; z-index: 1;
}
.tile-icon { font-size: 18px; line-height: 1; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2)); }
.tile-body {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    padding: 1px 2px 2px; text-align: center;
    background: linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.8) 55%, rgba(255,255,255,0) 100%);
}
.tile-name {
    font-size: 6.5px; line-height: 1.05;
    color: #1a2634; font-weight: 900;
    overflow: hidden; max-height: 1.1em; width: 100%;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.95), 0 0 2px rgba(255,255,255,0.8);
}
.tile-name.sm { font-size: 5.5px; line-height: 1.05; max-height: 2.1em; }
.tile-price {
    position: absolute; top: 20%; right: 2px;
    font-size: 5.5px; color: #1f618d; font-weight: 900;
    background: rgba(255,255,255,0.92);
    padding: 0 2px; border-radius: 3px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.08); z-index: 3;
}
.tile-house {
    position: absolute; bottom: 2px; right: 2px; z-index: 5;
    background: #fff;
    border-radius: 50%;
    padding: 2px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.28);
    display: flex; align-items: center; justify-content: center;
}
.tile-house-img { width: 26px; height: 26px; object-fit: contain; display: block; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.25)); }
/* 已购未盖房：业主色小圆底托 + 小房子图标，区别于纯点 */
.tile-house.owned {
    width: 17px; height: 17px;
    background: var(--owner-color, #5dade2);
    box-shadow: 0 0 0 1.5px #fff, 0 2px 4px rgba(0,0,0,0.3);
    padding: 0;
}
.tile-house-owned { font-size: 11px; line-height: 1; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2)); }
/* 盖房等级数字徽标：房屋图标右下角，白字深色底 */
.tile-house-badge {
    position: absolute;
    right: -5px; bottom: -5px;
    min-width: 15px; height: 15px; padding: 0 3px;
    border-radius: 999px;
    background: #1f2937; color: #fff;
    font-size: 10px; font-weight: 900; line-height: 15px; text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    z-index: 6;
    pointer-events: none;
}
.tile-owner {
    position: absolute; top: 2px; left: 2px;
    width: 9px; height: 9px; border-radius: 50%; z-index: 4;
    box-shadow: 0 0 0 1.5px #fff, 0 1px 2px rgba(0,0,0,0.25);
}

/* ===== 棋盘中央镇中心广场 ===== */
.board-center-scene {
    position: absolute;
    left: 16%; right: 16%; top: 16%; bottom: 16%;
    z-index: 8;
    pointer-events: none;
    display: flex; align-items: center; justify-content: center;
    /* 中央空地区域加一层淡淡的草坪/广场渐变，减少中空感 */
    background: radial-gradient(ellipse at center, rgba(167, 243, 208, 0.45) 0%, rgba(186, 230, 253, 0.18) 45%, rgba(186, 230, 253, 0.0) 72%);
    border-radius: 50%;
}
.center-plaza {
    position: relative;
    width: 100%; height: 100%;
    display: block;
}
.plaza-floor {
    position: absolute; left: 5%; right: 5%; bottom: 5%; height: 40%;
    background: radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 60%, transparent 75%);
    border-radius: 50%;
    transform: scaleY(0.45);
    box-shadow: 0 12px 30px rgba(0,0,0,0.12);
}
.plaza-ring {
    position: absolute; left: 0; right: 0; top: 20%; bottom: 10%;
    border: 3px dashed rgba(255,255,255,0.55);
    border-radius: 50%;
    transform: scaleY(0.5);
}
.center-char {
    position: absolute;
    left: 50%; bottom: 15%;
    transform: translateX(-50%);
    max-width: 82%;
    max-height: 76%;
    width: auto; height: auto;
    object-fit: contain; object-position: bottom center;
    filter: drop-shadow(0 8px 14px rgba(0,0,0,0.2));
    z-index: 2;
}
.center-namewrap {
    position: absolute;
    left: 50%; bottom: 2%;
    transform: translateX(-50%);
    z-index: 3;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.center-name {
    padding: 3px 12px;
    background: rgba(255,255,255,0.95);
    border: 2px solid rgba(93, 173, 226, 0.5);
    border-radius: 14px;
    font-size: 12px; font-weight: 900; color: #1a2634;
    box-shadow: 0 4px 10px rgba(0,0,0,0.12);
    white-space: nowrap;
}
.center-you {
    font-size: 9px; background: #5dade2; color: #fff;
    border-radius: 6px; padding: 0 4px; margin-left: 3px;
}
.center-dice {
    position: relative; z-index: 3;
    margin-top: 5px;
    display: flex; align-items: center; gap: 3px;
    padding: 3px 10px;
    background: linear-gradient(180deg, #5dade2 0%, #2e86c1 100%);
    border-radius: 12px;
    color: #fff;
    box-shadow: 0 4px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.3);
}
.cd-pip { font-size: 13px; font-weight: 900; }
.cd-plus, .cd-eq { font-size: 10px; opacity: 0.85; }
.cd-total { font-size: 15px; font-weight: 900; }

/* ===== 落点/点击地块立绘（移动结束 / 点击地块后显示，替换中央角色立绘） ===== */
/* v3: 棋盘中央直接显示该地块完整立绘，占中央区域大部分；底部显示名称 + 价格/租金/功能详情。
   骰子演出期间（gs.phase==='dice'）模板 v-if 已隐藏；关闭按钮调用 clearLanded 恢复角色立绘。
   父级 .board-center-scene 是 pointer-events:none，故视图需 pointer-events:auto 才接收关闭点击。 */
.center-tile-view {
    position: absolute;
    left: 0; right: 0; top: 0; bottom: 0;
    z-index: 12;
    pointer-events: auto;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px;
    padding: 4px;
}
.center-tile-img {
    max-width: 88%;
    max-height: 72%;
    width: auto; height: auto;
    object-fit: contain;
    border-radius: 14px;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,0.22));
}
.center-tile-info {
    position: absolute;
    left: 50%; bottom: 4px;
    transform: translateX(-50%);
    z-index: 3;
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    width: 96%;
}
.center-tile-name {
    padding: 3px 12px;
    background: rgba(255,255,255,0.96);
    border: 2px solid rgba(93, 173, 226, 0.5);
    border-radius: 14px;
    font-size: 13px; font-weight: 900; color: #1a2634;
    box-shadow: 0 4px 10px rgba(0,0,0,0.14);
    white-space: nowrap;
    max-width: 96%;
    overflow: hidden; text-overflow: ellipsis;
}
.center-tile-detail {
    padding: 2px 10px;
    background: rgba(255,255,255,0.9);
    border-radius: 10px;
    font-size: 10px; font-weight: 700; color: #51637a;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    max-width: 96%;
    text-align: center;
    line-height: 1.3;
}
.center-tile-close {
    position: absolute; top: 4px; right: 4px;
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.92);
    border: 1px solid rgba(93, 173, 226, 0.4);
    color: #2e86c1; font-size: 12px; font-weight: 900;
    pointer-events: auto;
    box-shadow: 0 2px 4px rgba(0,0,0,0.14);
    z-index: 4;
}

/* ===== 操作气泡（棋盘中央逐个飘出） ===== */
.action-bubble-layer {
    position: absolute;
    left: 50%;
    top: 44%;
    transform: translate(-50%, -50%);
    z-index: 45;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 92%;
}
.action-bubble {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(330px, 88%);
    padding: 9px 15px;
    border-radius: 18px;
    background: rgba(30, 41, 59, 0.88);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.30);
    border: 2px solid var(--bub-color, #5dade2);
    text-align: left;
    word-break: break-word;
}
.action-bubble .ab-icon { font-size: 19px; flex-shrink: 0; }
.action-bubble.kind-good { background: rgba(33, 140, 60, 0.92); }
.action-bubble.kind-bad { background: rgba(178, 40, 40, 0.92); }
.bubble-enter-active { animation: bubbleIn .32s ease-out; }
.bubble-leave-active { animation: bubbleOut .38s ease-in forwards; }
@keyframes bubbleIn {
    0% { opacity: 0; transform: scale(.7) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes bubbleOut {
    0% { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(1.12) translateY(-12px); }
}

/* ===== 站立式棋子（全身立绘） ===== */
.token {
    position: absolute;
    /* 略缩整体尺寸，让单棋子更居中于 tile base；translateZ 降到 20px 减少“悬浮感” */
    width: 34px; height: 48px;
    /* translateZ 把棋子抬到格子之上（tile-face 在 translateZ(5px)），否则会被棋盘格挡住 */
    transform: translate(-50%, -100%) translateZ(20px);
    transform-style: preserve-3d;
    z-index: 30;
    transition: left 0.15s linear, top 0.15s linear;
    filter: drop-shadow(0 6px 7px rgba(0,0,0,0.3));
}
.token.active {
    z-index: 31;
    transform: translate(-50%, -100%) translateZ(26px);
    filter: drop-shadow(0 0 9px #f4d03f) drop-shadow(0 6px 9px rgba(0,0,0,0.32));
}
.token-base {
    position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 24px; height: 10px;
    border-radius: 50%;
    box-shadow: 0 3px 6px rgba(0,0,0,0.32);
    border: 1.5px solid #fff;
}
.token-stand {
    /* bottom 降到 2px，让角色 feet 更贴近 token-base（落在底台上） */
    position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
    width: 32px; height: 46px;
    display: flex; align-items: flex-end; justify-content: center;
}
.token-stand img {
    width: 100%; height: 100%;
    object-fit: contain; object-position: bottom center;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
}
.token-stand span { font-size: 22px; }
.tok-dead { position: absolute; bottom: 0; font-size: 16px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3)); }

/* ===== AI 思考气泡 ===== */
.think-bubble {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.95);
    border: 1.5px solid #aed6f1;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    animation: bobble 2s infinite;
}
.think-emoji { font-size: 20px; }
.think-text { font-size: 12px; color: #1a2634; font-weight: 700; }
@keyframes bobble {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
}

/* ===== 角色卡 ===== */
.hero-card {
    display: flex; gap: 8px;
    padding: 8px;
    background: linear-gradient(145deg, #fefefe 0%, #ebf5fb 100%);
    border: 2px solid #aed6f1;
    border-radius: 14px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.08);
}
.hero-left {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.hero-avatar {
    width: 56px; height: 64px;
    border-radius: 10px;
    overflow: hidden;
    border: 2.5px solid #fff;
    box-shadow: 0 5px 12px rgba(0,0,0,0.16);
    background: linear-gradient(180deg, #e3f2fd 0%, #bbdefb 100%);
}
.hero-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.hero-avatar span { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; }
.hero-cash {
    display: flex; align-items: center; gap: 2px;
    padding: 1px 6px; border-radius: 999px;
    background: linear-gradient(180deg, #fff8e1 0%, #ffecb3 100%);
    border: 1px solid #ffe082;
    font-size: 11px; font-weight: 900; color: #b45309;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}
.hero-right {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; justify-content: center; gap: 4px;
}
.hero-name {
    font-size: 15px; font-weight: 900; color: #1a2634;
    display: flex; align-items: center; gap: 4px;
}
.hero-you {
    font-size: 9px; background: #5dade2; color: #fff;
    border-radius: 5px; padding: 1px 4px;
}
.hero-species { font-size: 10px; color: #5dade2; font-weight: 700; }
.hero-status { font-size: 10px; font-weight: 800; }
.status-jail { color: #e74c3c; }
.status-thinking { color: #2e86c1; }
.status-turn { color: #27ae60; }
.hero-dice { display: flex; gap: 5px; margin-top: 2px; }
.die {
    width: 26px; height: 26px;
    background: linear-gradient(145deg, #fff, #ebf5fb);
    border: 1.5px solid #5dade2;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: #2e86c1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1), inset 0 -2px 0 rgba(46, 134, 193, 0.1);
}
.die.rolling { animation: diceroll 0.4s infinite; }
@keyframes diceroll { 0%, 100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.08); } }

/* ===== 地块详情卡 ===== */
.tile-card {
    display: flex; gap: 10px; align-items: center;
    padding: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #ffe082;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.tile-card-img {
    width: 56px; height: 56px;
    border-radius: 10px; object-fit: cover;
    border: 2px solid #fff;
    box-shadow: 0 3px 8px rgba(0,0,0,0.12);
}
.tile-card-body { flex: 1; min-width: 0; }
.tile-card-name {
    font-size: 13px; font-weight: 900; color: #1a2634;
    display: flex; align-items: center; gap: 5px;
}
.tile-card-name .dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
.tile-card-line { font-size: 10px; color: #6b7280; line-height: 1.4; margin-top: 2px; }

/* ===== 操作按钮区 ===== */
.action-deck {
    padding: 8px;
    background: rgba(255, 255, 255, 0.92);
    border: 2px solid rgba(174, 214, 241, 0.6);
    border-radius: 14px;
    box-shadow: 0 5px 14px rgba(0,0,0,0.06);
}
.game-btn {
    padding: 11px 8px; border-radius: 12px;
    font-weight: 900; color: #fff; text-align: center;
    transition: all 0.12s;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow:
        0 4px 0 rgba(0,0,0,0.18),
        0 5px 8px rgba(0,0,0,0.1),
        inset 0 1px 0 rgba(255,255,255,0.3);
    text-shadow: 0 1px 1px rgba(0,0,0,0.2);
    font-size: 14px;
}
.game-btn:active {
    transform: translateY(4px);
    box-shadow:
        0 1px 0 rgba(0,0,0,0.18),
        0 2px 4px rgba(0,0,0,0.12),
        inset 0 1px 0 rgba(255,255,255,0.3);
}
.game-btn:disabled { opacity: 0.5; filter: grayscale(0.4); }
.game-btn.blue { background: linear-gradient(180deg, #5dade2 0%, #2e86c1 100%); box-shadow: 0 5px 0 #1a5276, 0 6px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.blue:active { box-shadow: 0 1px 0 #1a5276, 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.yellow { background: linear-gradient(180deg, #f4d03f 0%, #d4ac0d 100%); box-shadow: 0 5px 0 #9a7d0a, 0 6px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); color: #4a3b05; }
.game-btn.yellow:active { box-shadow: 0 1px 0 #9a7d0a, 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.green { background: linear-gradient(180deg, #52be80 0%, #27ae60 100%); box-shadow: 0 5px 0 #1e8449, 0 6px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.green:active { box-shadow: 0 1px 0 #1e8449, 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.sky { background: linear-gradient(180deg, #85c1e9 0%, #5dade2 100%); box-shadow: 0 5px 0 #2874a6, 0 6px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.game-btn.gray { background: linear-gradient(180deg, #bdc3c7 0%, #95a5a6 100%); box-shadow: 0 5px 0 #6c7a7d, 0 6px 10px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }
.roll-btn {
    font-size: 17px; padding: 14px;
    background: linear-gradient(180deg, #f4d03f 0%, #d4ac0d 100%);
    color: #4a3b05;
    box-shadow: 0 5px 0 #9a7d0a, 0 7px 14px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.4);
}
.roll-btn:active { box-shadow: 0 1px 0 #9a7d0a, 0 2px 5px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.4); }
.waiting-text {
    text-align: center; color: #94a3b8; font-size: 12px; font-weight: 700;
    padding: 12px 0;
}

.build-section { margin-top: 10px; }
.build-title { font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 5px; }
.build-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 3px; }
.build-chip {
    flex: 0 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 5px 8px;
    background: linear-gradient(180deg, #fefefe 0%, #e8f6fc 100%);
    border: 1.5px solid #aed6f1; border-radius: 10px;
    font-size: 10px; color: #1f618d; min-width: 68px;
    box-shadow: 0 3px 0 #8ecae6, 0 4px 6px rgba(0,0,0,0.06);
    transition: transform 0.1s;
}
.build-chip:active { transform: translateY(2px); box-shadow: 0 1px 0 #8ecae6, 0 2px 4px rgba(0,0,0,0.06); }
.build-chip.full { background: linear-gradient(180deg, #fef9e7 0%, #fde68a 100%); border-color: #f4d03f; color: #9a7d0a; box-shadow: 0 3px 0 #d4ac0d, 0 4px 6px rgba(0,0,0,0.06); }
.build-chip:disabled { opacity: 0.5; box-shadow: none; }
.build-chip-img { width: 16px; height: 16px; object-fit: contain; }

/* ===== 手牌区 ===== */
.card-hand {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid rgba(174, 214, 241, 0.5);
    border-radius: 12px; padding: 6px 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.card-hand-title { font-size: 10px; font-weight: 800; color: #1a2634; margin-bottom: 4px; }
.card-hand-scroll { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 1px; }
.mini-card {
    position: relative;
    flex: 0 0 66px; height: 90px;
    background: white;
    border: 2px solid #5dade2;
    border-radius: 9px;
    overflow: hidden;
    text-align: center;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
    box-shadow: 0 3px 0 rgba(93, 173, 226, 0.4), 0 4px 7px rgba(0,0,0,0.1);
}
.mini-card:active { transform: translateY(3px) scale(0.97); box-shadow: 0 1px 0 rgba(93, 173, 226, 0.4), 0 2px 4px rgba(0,0,0,0.1); }
.mini-card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.mini-card-type { position: absolute; top: 3px; left: 3px; z-index: 2; padding: 1px 6px; border-radius: 6px; color: white; font-size: 8px; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.mini-card-name { position: absolute; bottom: 0; left: 0; right: 0; z-index: 2; font-size: 9px; font-weight: 800; color: #1a2634; padding: 10px 2px 3px; line-height: 1.1; background: linear-gradient(to top, rgba(255,255,255,0.98) 30%, rgba(255,255,255,0.7) 70%, rgba(255,255,255,0) 100%); }

/* ===== 日志面板 ===== */
.log-panel {
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid rgba(174, 214, 241, 0.5);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    overflow: hidden;
}
.log-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 12px;
    font-size: 10px; font-weight: 900; color: #1a2634;
    cursor: pointer;
    background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%);
}
.log-body {
    max-height: 120px;
    overflow-y: auto;
    padding: 6px 12px;
    display: flex; flex-direction: column; gap: 4px;
}
.log-item {
    font-size: 11px; color: #475569; line-height: 1.45;
    padding: 4px 0; border-bottom: 1px dashed rgba(174, 214, 241, 0.4);
    margin: 0;
}
.log-item:last-child { border-bottom: none; }

/* ===== 卡牌动画 ===== */
.card-anim-overlay {
    position: fixed; inset: 0; z-index: 150;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
    background: rgba(0, 0, 0, 0.12);
}
.card-anim-box {
    background: white;
    border: 3px solid #5dade2;
    border-radius: 18px;
    padding: 20px 28px;
    text-align: center;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
    animation: cardPop 1.5s ease-out forwards;
}
.card-anim-type {
    display: inline-block; padding: 3px 12px; border-radius: 10px;
    color: white; font-size: 10px; font-weight: 700; margin-bottom: 10px;
}
.card-anim-name { font-size: 20px; font-weight: 900; color: #1a2634; }
.card-anim-desc { font-size: 12px; color: #64748b; margin-top: 6px; }
.card-anim-player { font-size: 11px; color: #94a3b8; margin-top: 10px; }
.card-pop-img { width: 120px; height: 160px; object-fit: cover; border-radius: 12px; margin: 0 auto 10px; border: 2px solid #fff; box-shadow: 0 6px 16px rgba(0,0,0,0.18); }
/* 道具卡使用：点击"使用"后缩放 + 光晕扩散动画 */
.card-burst { animation: card-burst 0.5s ease-out; }
@keyframes card-burst {
    0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(244, 208, 63, 0.9)); }
    50% { transform: scale(1.12); filter: drop-shadow(0 0 22px rgba(244, 208, 63, 0.95)); }
    100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(244, 208, 63, 0)); }
}
@keyframes cardPop {
    0% { transform: scale(0.5) rotate(-10deg) translateY(40px); opacity: 0; }
    20% { transform: scale(1.1) rotate(2deg) translateY(0); opacity: 1; }
    80% { transform: scale(1) rotate(0deg) translateY(0); opacity: 1; }
    100% { transform: scale(0.9) rotate(0deg) translateY(-20px); opacity: 0; }
}

/* ===== 悬浮聊天 ===== */
.float-chat-panel {
    position: absolute; top: 50%; right: 12px; transform: translateY(-50%); z-index: 60;
    display: flex; flex-direction: column;
    width: 42%; min-width: 220px; max-width: 320px; height: 64%; max-height: 520px;
    background: rgba(255, 255, 255, 0.96);
    border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22); padding: 12px;
}
.fc-close { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #7fb3d5; transition: all 0.15s; }
.fc-close:hover { background: #ebf5fb; color: #2e86c1; }
.chat-row { display: flex; flex-direction: column; align-items: flex-start; }
.chat-row.me { align-items: flex-end; }
.chat-name { font-size: 9px; color: #64748b; margin-bottom: 1px; padding: 0 2px; }
.chat-bubble {
    max-width: 92%; padding: 7px 11px; border-radius: 12px;
    font-size: 11px; line-height: 1.4;
    background: #f1f5f9; color: #1a2634;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06); word-break: break-word;
}
.chat-row.me .chat-bubble { background: #5dade2; color: #fff; }

/* ===== 胜利结算 ===== */
.result-card {
    background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%);
    border: 3px solid #f4d03f;
    border-radius: 24px;
    width: 100%; max-width: 380px; padding: 24px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.8);
    text-align: center;
}
.result-crown { font-size: 56px; margin-bottom: 4px; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.15)); }
.result-winner { font-size: 24px; font-weight: 900; color: #2e86c1; margin-bottom: 4px; }
.result-species { font-size: 13px; color: #94a3b8; margin-bottom: 16px; }
.result-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
.result-row {
    display: flex; align-items: center;
    background: #f8fafc; border-radius: 12px; padding: 10px 12px;
    font-size: 13px;
}
.result-rank {
    width: 22px; height: 22px; border-radius: 50%;
    background: #e2e8f0; color: #64748b; font-size: 11px; font-weight: 900;
    display: flex; align-items: center; justify-content: center; margin-right: 10px;
}
.result-name { flex: 1; min-width: 0; text-align: left; font-weight: 800; color: #1a2634; }
.result-you { color: #2e86c1; margin-left: 3px; }
.result-worth { font-weight: 900; color: #b45309; }
.result-btn {
    width: 100%; padding: 14px;
    background: linear-gradient(180deg, #5dade2 0%, #2e86c1 100%);
    color: #fff; font-weight: 900; font-size: 15px;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 5px 0 #1a5276, 0 6px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3);
    transition: transform 0.1s;
}
.result-btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #1a5276, 0 2px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.3); }

/* ===== 主内容区（竖屏单列可滚动 / 横屏两栏） ===== */
.game-body { display: flex; }

/* 横屏：两栏，棋盘占左，信息栏占右并独立滚动 */
@media (orientation: landscape) {
    .landscape\:flex { display: flex; }
    .landscape\:flex-row { flex-direction: row; }
    .landscape\:overflow-hidden { overflow: hidden; }
    .landscape\:overflow-y-auto { overflow-y: auto; }
    .landscape\:min-h-0 { min-height: 0; }

    .game-body { flex: 1 1 0%; min-height: 0; flex-direction: row; }
    .board-stage { flex: 1 1 0%; padding: 16px 8px 8px; }
    .board-table { width: min(100%, calc(100vh - 60px)); }

    .side-col {
        max-width: 360px;
        padding: 8px 10px;
    }
    .hero-card { padding: 8px; }
    .hero-avatar { width: 56px; height: 64px; }
    .hero-name { font-size: 14px; }
    .log-body { max-height: 120px; }
}

/* 竖屏：单列。棋盘区 sticky 固定顶部（在 HUD 之下），下方信息区随主容器纵向滚动 */
@media (orientation: portrait) {
    .game-body { flex: none; flex-direction: column; min-height: 0; }
    .board-stage {
        flex: none;
        width: 100%;
        position: sticky;
        /* HUD 高 56px，sticky top 与之对齐，确保棋盘不被遮挡 */
        top: 56px;
        z-index: 14;
        /* 顶部留白，避免最顶一排格子/棋子被 HUD 遮住（竖屏下加大顶部空间） */
        padding: 42px 8px 12px;
        overflow: visible;
    }
    /* 棋盘高度按视口高度封顶，确保 11×11 最外圈完整落在视口内（HUD 占 40px） */
    .board-table { width: min(100%, calc(100vh - 84px)); }
    .side-col { max-width: none; }
}

/* ===== 小屏竖屏紧凑 ===== */
@media (max-width: 380px) {
    .tile-name { font-size: 6.5px; }
    .tile-price { font-size: 5.5px; }
    .tile-icon { font-size: 14px; }
    .center-name { font-size: 10px; }
    .center-dice { padding: 2px 6px; }
    .hero-avatar { width: 54px; height: 62px; }
    .hero-name { font-size: 14px; }
    .die { width: 26px; height: 26px; font-size: 18px; }
    .mini-card { flex-basis: 66px; height: 92px; }
}

.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translate(20px, -50%); opacity: 0; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.card-pop-enter-active, .card-pop-leave-active { transition: opacity 0.2s; }
.card-pop-enter-from, .card-pop-leave-to { opacity: 0; }

/* ===== 操作视觉特效层（纯视觉，不阻塞逻辑） ===== */
.fx-layer {
    position: fixed;
    inset: 0;
    z-index: 120;
    pointer-events: none;
    overflow: hidden;
}
/* 棋盘轻微抖动（惩罚/入狱） */
.fx-shake { animation: fxShake 0.42s ease-in-out; }
@keyframes fxShake {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(-4px, 2px); }
    40% { transform: translate(4px, -2px); }
    60% { transform: translate(-3px, 1px); }
    80% { transform: translate(3px, -1px); }
}
/* 买地：金币飘落 */
.fx-coins { position: absolute; inset: 0; }
.fx-coin {
    position: absolute; top: -8%;
    font-size: 22px;
    animation: fxCoinFall 1s ease-in forwards;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25));
}
@keyframes fxCoinFall {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
}
/* 红/灰闪 */
.fx-flash { position: absolute; inset: 0; pointer-events: none; }
.fx-flash-red { background: radial-gradient(circle at 50% 50%, rgba(231,76,60,0.0) 30%, rgba(231,76,60,0.42) 100%); animation: fxFlashRed 0.3s ease-out forwards; }
@keyframes fxFlashRed { 0% { opacity: 0; } 40% { opacity: 1; } 100% { opacity: 0; } }
.fx-flash-gray { background: rgba(120,120,130,0.45); animation: fxFadeGray 0.5s ease-out forwards; }
.fx-fade-gray { background: rgba(90,90,100,0.5); animation: fxFadeGray 0.9s ease-out forwards; }
@keyframes fxFadeGray { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
/* 破产：💀 飘落 */
.fx-skull {
    position: absolute; left: 50%; top: -10%;
    font-size: 30px;
    animation: fxSkullFall 1.2s ease-in forwards;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
}
@keyframes fxSkullFall {
    0% { transform: translate(-50%, -10vh) rotate(0deg); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(-50%, 105vh) rotate(220deg); opacity: 0; }
}
/* 盖房：目标格子金光 */
.fx-glow {
    position: absolute;
    border-radius: 8px;
    background: radial-gradient(circle, rgba(244,208,63,0.85) 0%, rgba(244,208,63,0.0) 70%);
    box-shadow: 0 0 18px 6px rgba(244, 208, 63, 0.7);
    animation: fxGlow 0.5s ease-out forwards;
    pointer-events: none;
}
@keyframes fxGlow {
    0% { opacity: 0; transform: scale(0.6); }
    30% { opacity: 1; }
    100% { opacity: 0; transform: scale(1.25); }
}
/* 抽卡：卡牌从中央飞出 */
.fx-card-fly {
    position: absolute; left: 50%; top: 50%;
    font-size: 34px;
    transform: translate(-50%, -50%);
    animation: fxCardFly 0.9s ease-out forwards;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
}
@keyframes fxCardFly {
    0% { transform: translate(-50%, -50%) scale(0.3) rotate(-20deg); opacity: 0; }
    25% { opacity: 1; transform: translate(-50%, -50%) scale(1.15) rotate(6deg); }
    100% { transform: translate(60%, -160%) scale(0.8) rotate(20deg); opacity: 0; }
}
/* 收租：金币从付款方位置飞出 */
.fx-rent {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 0; height: 0;
}
.fx-coin-fly {
    position: absolute; left: 0; top: 0;
    font-size: 20px;
    animation: fxCoinFly 1s ease-out forwards;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25));
}
@keyframes fxCoinFly {
    0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translate(var(--dx, 0), var(--dy, -60px)) scale(1); opacity: 0; }
}
</style>
