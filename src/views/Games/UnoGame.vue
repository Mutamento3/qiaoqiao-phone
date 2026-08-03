<template>
    <div class="uno-game w-full h-full flex flex-col relative overflow-hidden" :class="{ 'uno-land': effectiveLandscape, 'uno-wide': isWide }" @click="onRootClick">
        <div class="uno-grain"></div>
        <div class="table-felt"></div>
        <!-- 顶部栏 -->
        <div class="h-[52px] glass-bar flex items-center justify-between px-3 text-stone-600 shadow-sm z-20 flex-shrink-0">
            <button @click="backToLobby" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/30 transition-colors">
                <i class="fa-solid fa-chevron-left text-lg text-stone-500"></i>
            </button>
            <div class="flex items-center gap-2 text-sm">
                <span class="font-black tracking-wide text-rose-500">UNO</span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm" :class="ruleBadgeClass">{{ ruleName }}</span>
                <span class="text-stone-500 font-medium"><i class="fa-solid fa-rotate text-rose-400" :class="gs?.direction === 1 ? 'fa-flip-horizontal' : ''"></i> {{ gs?.direction === 1 ? '顺' : '逆' }}</span>
            </div>
            <div class="flex items-center gap-1.5">
                <button @click.stop="toggleLandscape"
                    class="flex items-center gap-1 h-8 px-2.5 rounded-full transition-all active:scale-90"
                    :class="effectiveLandscape ? 'bg-white/60 text-rose-500' : 'bg-rose-400 text-white font-bold shadow-md'"
                    :title="effectiveLandscape ? '切换竖屏' : '切换横屏'">
                    <i class="fa-solid fa-rotate text-xs"></i>
                    <span v-if="!effectiveLandscape" class="text-[10px]">横屏</span>
                </button>
                <span class="w-5 h-5 rounded-full border-2 border-white shadow-sm" :style="colorChipStyle"></span>
            </div>
        </div>

        <!-- 竖屏提示：建议横屏游玩 -->
        <Transition name="fade">
            <div v-if="showLandscapeHint" class="fixed top-[54px] inset-x-0 z-[120] flex justify-center px-3 pointer-events-none">
                <div class="bg-white/90 text-stone-600 text-[11px] px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto backdrop-blur-md border border-white/60">
                    <i class="fa-solid fa-rotate text-rose-400"></i>
                    <span>横屏体验更佳，点右上角「横屏」</span>
                    <button @click="dismissLandscapeHint" class="ml-1 w-5 h-5 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center leading-none">✕</button>
                </div>
            </div>
        </Transition>

        <!-- 对手区（横向滚动，适配 1~7 人） -->
        <div class="opponents-row flex justify-start items-start px-3 pt-3 gap-2.5 z-10 flex-shrink-0 overflow-x-auto pb-2">
            <div v-for="opp in opponents" :key="opp.id" :data-player-idx="opp.index"
                class="opp-panel flex flex-col items-center rounded-[22px] px-2.5 py-2.5 transition-all min-w-[76px] relative"
                :class="opp.isTurn ? 'opp-turn' : ''">
                <div class="relative">
                    <div v-if="isImageAvatar(opp.avatar)" class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                        <img :src="opp.avatar" class="w-full h-full object-cover" />
                    </div>
                    <div v-else class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white shadow-sm bg-rose-100 flex items-center justify-center text-lg">{{ opp.avatar || '👤' }}</div>
                    <div v-if="opp.isTurn" class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-400 rounded-full border-2 border-white shadow"></div>
                </div>
                <div class="text-stone-600 text-[10px] font-bold mt-1.5 max-w-[60px] truncate">{{ opp.name }}</div>
                <div class="flex mt-1.5 items-center" :data-player-hand="opp.index">
                    <div v-for="n in Math.min(opp.count, 4)" :key="n" class="uno-back-mini -ml-1 first:ml-0"></div>
                    <span v-if="opp.count > 4" class="text-stone-500 text-[9px] ml-1 font-medium">+{{ opp.count - 4 }}</span>
                </div>
                <div class="text-stone-400 text-[9px] mt-1 font-medium">{{ opp.count }} 张</div>
                <div v-if="opp.count === 1 && opp.calledUno" class="text-rose-500 text-[10px] font-black mt-0.5 animate-pulse">UNO!</div>

                <!-- AI 对话气泡 -->
                <div v-if="activeReplies[opp.index]" class="absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-stone-600 text-[10px] px-2.5 py-1.5 rounded-[10px] shadow-md whitespace-nowrap z-30 max-w-[120px] truncate border border-stone-100">
                    {{ activeReplies[opp.index] }}
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-b border-r border-stone-100"></div>
                </div>
            </div>
        </div>

        <!-- 中央牌堆 -->
        <div class="center-pile flex-1 flex items-center justify-center gap-7 relative z-10">
            <div ref="discardAnchor" class="flex flex-col items-center">
                <Transition name="cardPop">
                    <div v-if="topCard" :key="topCard.id" class="uno-card relative overflow-hidden"
                        :style="cardBg(topCard)" :class="cardTextClass(topCard)">
                        <span class="absolute top-1 left-1.5 text-[11px] font-black opacity-90 leading-none">{{ topCard?.symbol }}</span>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div v-if="topCard && topCard.color !== 'wild'" class="uno-oval flex items-center justify-center">
                                <span class="font-black leading-none text-4xl" :style="{ color: cardSymbolColor(topCard) }">{{ topCard.symbol }}</span>
                            </div>
                            <span v-else class="text-white text-4xl font-black leading-none drop-shadow">{{ topCard?.symbol }}</span>
                        </div>
                        <span class="absolute bottom-1 right-1.5 text-[11px] font-black opacity-90 leading-none rotate-180">{{ topCard?.symbol }}</span>
                    </div>
                </Transition>
                <div class="text-stone-500/80 text-xs mt-2 font-medium">弃牌堆</div>
            </div>

            <button @click="onDraw" :disabled="!isHumanTurn || !!pickingColor"
                class="draw-pile flex flex-col items-center active:scale-95 transition-transform disabled:opacity-60">
                <div class="uno-back w-[76px] h-[110px] relative overflow-hidden">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
                            <span class="text-rose-500 font-black text-sm">UNO</span>
                        </div>
                    </div>
                </div>
                <div class="text-stone-500/80 text-xs mt-2 font-medium">抽牌 ({{ gs?.deck.length }})</div>
            </button>
        </div>

        <!-- 事件提示：悬浮中央，更易注意到 -->
        <Transition name="fade">
            <div v-if="lastEvent" class="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-[45] pointer-events-none max-w-[80vw]">
                <div class="bg-white/90 text-stone-600 text-xs px-4 py-2 rounded-full shadow-xl border border-white/70 backdrop-blur-md font-medium truncate">
                    {{ lastEvent }}
                </div>
            </div>
        </Transition>

        <!-- 玩家手牌区 -->
        <div class="px-3 pb-3 z-10 flex-shrink-0">
            <div class="flex items-center justify-between mb-2 px-1 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <!-- 我的头像 + 网名（取自微信「我」界面资料） -->
                    <div class="relative flex items-center gap-1.5 bg-white/60 rounded-full pl-1 pr-2.5 py-1 shadow-sm border border-white/60 flex-shrink-0 transition-all"
                        :class="isHumanTurn ? 'ring-2 ring-rose-300' : ''">
                        <div v-if="isImageAvatar(me?.avatar)" class="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm">
                            <img :src="me.avatar" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm bg-rose-100 flex items-center justify-center text-base">{{ me?.avatar || '👤' }}</div>
                        <div class="flex flex-col leading-tight">
                            <span class="text-stone-600 text-xs font-bold truncate max-w-[72px]">{{ me?.name }}</span>
                            <span class="text-stone-400 text-[9px]">{{ humanHand.length }} 张</span>
                        </div>
                    </div>
                    <span v-if="isHumanTurn" class="text-rose-500 text-sm font-bold flex items-center gap-1 whitespace-nowrap"><span class="text-base">✦</span> 你的回合</span>
                    <span v-else class="text-stone-500 text-xs font-medium truncate">{{ currentPlayer?.name }} 的回合…</span>
                </div>
                <div class="flex gap-2">
                    <button v-if="showDumpStop" @click="stopDumpNow"
                        class="px-3.5 py-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-400 text-white font-bold text-xs shadow-md active:scale-90 animate-pulse">结束出牌</button>
                    <button v-if="showUnoBtn" @click="callUnoNow"
                        class="px-3.5 py-2 rounded-full bg-gradient-to-r from-rose-400 to-pink-400 text-white font-black text-xs shadow-md active:scale-90 animate-pulse">UNO!</button>
                    <button v-if="showDrawCTA" @click="onDraw"
                        class="px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-300 to-orange-300 text-white font-black text-xs shadow-md active:scale-90 animate-pulse">抽一张</button>
                    <button v-else-if="showPass" @click="humanPass"
                        class="px-3.5 py-2 rounded-full bg-white/70 text-stone-500 font-bold text-xs shadow-sm active:scale-90 border border-stone-100">过</button>
                    <button @click.stop="toggleChat"
                        class="w-9 h-9 rounded-full bg-white/70 text-stone-500 text-xs shadow-sm active:scale-90 relative border border-stone-100 flex items-center justify-center">
                        <i class="fa-solid fa-comment"></i>
                        <span v-if="unreadChat" class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-400 rounded-full text-[9px] text-white flex items-center justify-center">{{ unreadChat }}</span>
                    </button>
                </div>
            </div>
            <div class="hand-row flex overflow-x-auto gap-1.5 pb-2">
                <div v-for="(card, i) in humanHand" :key="card.id" :data-card-id="card.id" @click="onHumanCardClick(card)"
                    class="uno-card deal-in relative overflow-hidden flex-shrink-0"
                    :class="[
                        cardTextClass(card),
                        isHumanTurn && isPlayable(card.id) ? 'uno-playable cursor-pointer' : 'uno-unplayable',
                        isHumanTurn ? '' : 'cursor-default'
                    ]" :style="[cardBg(card), { animationDelay: (i * 45) + 'ms' }]">
                    <span class="absolute top-0.5 left-1 text-[10px] font-black opacity-90 leading-none">{{ card.symbol }}</span>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div v-if="card.color !== 'wild'" class="uno-oval flex items-center justify-center">
                            <span class="font-black leading-none text-2xl" :style="{ color: cardSymbolColor(card) }">{{ card.symbol }}</span>
                        </div>
                        <span v-else class="text-white text-2xl font-black leading-none drop-shadow">{{ card.symbol }}</span>
                    </div>
                    <span class="absolute bottom-0.5 right-1 text-[10px] font-black opacity-90 leading-none rotate-180">{{ card.symbol }}</span>
                </div>
            </div>
        </div>

        <!-- 颜色选择弹窗 -->
        <Transition name="fade">
            <div v-if="pickingColor" class="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-50 backdrop-blur-sm" @click.self="cancelColor">
                <div class="bg-white/95 rounded-3xl p-6 text-center shadow-2xl border border-white/60">
                    <div class="font-bold mb-5 text-stone-600 text-lg">选择颜色</div>
                    <div class="grid grid-cols-2 gap-4">
                        <button v-for="c in ['red', 'yellow', 'green', 'blue']" :key="c" @click="chooseColor(c)"
                            class="w-[72px] h-[72px] rounded-2xl shadow-lg active:scale-95 border-[3px] border-white" :style="{ background: COLOR_META[c].hex }"></button>
                    </div>
                    <button @click="cancelColor" class="mt-5 text-stone-400 text-sm hover:text-stone-600">取消</button>
                </div>
            </div>
        </Transition>

        <!-- 结算弹窗 -->
        <Transition name="fade">
            <div v-if="gs?.phase === 'finished'" class="fixed inset-0 bg-stone-900/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                <div class="bg-gradient-to-br from-rose-50 to-orange-50 rounded-[28px] p-6 w-[300px] text-center shadow-2xl border border-white/70">
                    <div class="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden border-[3px] border-white shadow-lg bg-rose-100 flex items-center justify-center">
                        <img v-if="isImageAvatar(winnerInfo?.winnerAvatar)" :src="winnerInfo?.winnerAvatar" class="w-full h-full object-cover" />
                        <div v-else class="text-4xl">{{ winnerInfo?.winnerAvatar || '👤' }}</div>
                    </div>
                    <h2 class="text-2xl font-black text-stone-700 mb-1">{{ winnerInfo?.winnerName }}</h2>
                    <p class="text-stone-500 mb-4 font-medium">{{ winnerInfo?.isUser ? '🎉 你赢了！' : '本局获胜' }}</p>
                    <div v-if="winnerInfo?.changes" class="bg-white/70 rounded-2xl p-3 mb-4 text-sm border border-stone-100">
                        <div v-for="c in winnerInfo.changes" :key="c.idx" class="flex justify-between py-0.5" :class="c.isWinner ? 'text-rose-500 font-bold' : 'text-stone-500'">
                            <span>{{ c.name }}</span>
                            <span>{{ c.amount > 0 ? '+' : '' }}{{ c.amount }}豆</span>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <!-- 结算弹窗的“返回大厅”直接离开并跳转，不再二次弹出确认框（避免用户以为无效） -->
                        <button @click="confirmBack" class="flex-1 py-3 bg-white text-stone-500 rounded-2xl font-bold active:scale-95 shadow-sm border border-stone-100">返回大厅</button>
                        <button @click="playAgain" class="flex-1 py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-2xl font-bold active:scale-95 shadow-md">再来一局</button>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 弹幕层（浮于游戏区之上，不拦截点击） -->
        <div class="danmaku-layer absolute inset-0 pointer-events-none z-[55] overflow-hidden">
            <div v-for="dm in danmakuList" :key="dm.id"
                class="absolute flex items-center gap-2 animate-danmaku"
                :style="{ top: dm.top + '%', animationDuration: dm.duration + 's' }">
                <div class="w-7 h-7 rounded-full overflow-hidden border border-white/60 shadow bg-white/30 flex items-center justify-center shrink-0">
                    <img v-if="isImageAvatar(dm.avatar)" :src="dm.avatar" class="w-full h-full object-cover" />
                    <span v-else class="text-xs font-bold text-white drop-shadow">{{ dm.avatar || (dm.sender && dm.sender[0]) || '👤' }}</span>
                </div>
                <div class="flex items-center gap-1 whitespace-nowrap px-1" style="text-shadow: 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 4px rgba(0,0,0,0.8);">
                    <span class="text-sm font-black tracking-wide" :style="{ color: dm.color }">{{ dm.sender }}:</span>
                    <span class="text-white text-sm font-bold">{{ dm.text }}</span>
                </div>
            </div>
        </div>

        <!-- 聊天面板（右侧悬浮，仿麻将） -->
        <Transition name="slide-right">
            <div v-if="showChat" @click.stop
                class="chat-float absolute top-1/2 right-2 -translate-y-1/2 z-[60] flex flex-col
                       w-[38%] min-w-[200px] max-w-[300px] h-[58%] max-h-[460px]
                       bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/60 p-3">
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-stone-100">
                    <h3 class="text-stone-600 text-xs font-bold flex items-center gap-1.5"><i class="fa-solid fa-comments text-rose-400"></i> 局内对话</h3>
                    <button @click="showChat = false" class="text-stone-300 hover:text-stone-500 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-stone-100"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div ref="chatScroll" class="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 scrollbar-none">
                    <div v-if="gameChatMessages.length === 0" class="text-center text-stone-400 text-[10px] py-4">说点什么，AI 好友会回应你</div>
                    <div v-for="(msg, idx) in gameChatMessages" :key="idx" :class="msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                        <div class="text-[9px] text-stone-400 mb-0.5 px-0.5">{{ msg.sender }}</div>
                        <div :class="msg.role === 'user' ? 'bg-rose-400 text-white rounded-2xl rounded-tr-sm' : 'bg-stone-100 text-stone-600 rounded-2xl rounded-tl-sm'"
                            class="px-2.5 py-1.5 text-[10px] shadow-sm max-w-[95%] break-words leading-tight">
                            {{ msg.content }}
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-2 bg-stone-50 p-2.5 rounded-2xl">
                    <input v-model="chatInput" @keyup.enter="sendChat" placeholder="给TA们发消息..."
                        class="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-600 text-[11px] outline-none focus:border-rose-300 transition-colors" />
                    <button @click="sendChat" class="w-full bg-gradient-to-r from-rose-400 to-pink-400 hover:from-rose-500 hover:to-pink-500 text-white py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-all shadow-md">发送</button>
                    <div class="flex gap-1.5 justify-between">
                        <span v-for="quick in ['快点', '求牌', '哈哈']" :key="quick" @click="chatInput = quick === '快点' ? '快点出牌啊' : quick === '求牌' ? '能不能让我一张' : '哈哈哈'"
                            class="flex-1 text-center text-[9px] text-stone-400 cursor-pointer hover:text-rose-500 hover:bg-rose-50 bg-white py-1 rounded-lg transition-colors border border-stone-100">{{ quick }}</span>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- 退出确认 -->
        <div v-if="showConfirm" class="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
            <div class="bg-white/95 rounded-3xl p-6 max-w-[300px] w-full shadow-2xl border border-white/60">
                <h3 class="text-lg font-bold text-center mb-3 text-stone-600">退出对局</h3>
                <p class="text-center text-stone-400 mb-6 text-sm">确定要退出当前对局吗？</p>
                <div class="flex gap-3">
                    <button @click="showConfirm = false" class="flex-1 py-2.5 bg-stone-100 text-stone-500 rounded-2xl font-bold text-sm active:scale-95">取消</button>
                    <button @click="confirmBack" class="flex-1 py-2.5 bg-rose-400 text-white rounded-2xl font-bold text-sm active:scale-95">退出</button>
                </div>
            </div>
        </div>

        <!-- 开局摇骰子过场：决定先后手，避免每次玩家先出 -->
        <Transition name="fade">
            <div v-if="diceVisible" class="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-rose-100/95 pointer-events-none backdrop-blur-sm">
                <div class="text-stone-600 text-sm mb-5 tracking-wide font-medium">🎲 摇骰子决定先后手</div>
                <div class="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center text-5xl font-black text-rose-500 border-4 border-white"
                    :class="diceRolling ? 'dice-shake' : ''">{{ diceValue }}</div>
                <Transition name="fade">
                    <div v-if="!diceRolling && diceDone" class="mt-5 text-rose-500 font-black text-lg">
                        {{ diceFirstPlayer }} 先出！
                    </div>
                </Transition>
                <div v-if="diceRolling" class="mt-4 text-stone-400 text-xs font-medium">发牌中…</div>
            </div>
        </Transition>

        <!-- 出牌飞行动画：克隆一张牌从出牌人位置飞到中央弃牌堆 -->
        <div v-if="flyingCard" class="flying-card fixed z-[160] pointer-events-none"
            :style="flyingCardStyle">
            <div v-if="flyingCard.card.isBack" class="uno-card uno-back relative overflow-hidden w-full h-full"></div>
            <div v-else class="uno-card relative overflow-hidden w-full h-full"
                :style="cardBg(flyingCard.card)" :class="cardTextClass(flyingCard.card)">
                <span class="absolute top-0.5 left-1 text-[10px] font-black opacity-90 leading-none">{{ flyingCard.card.symbol }}</span>
                <div class="absolute inset-0 flex items-center justify-center">
                    <div v-if="flyingCard.card.color !== 'wild'" class="uno-oval flex items-center justify-center">
                        <span class="font-black leading-none text-2xl" :style="{ color: cardSymbolColor(flyingCard.card) }">{{ flyingCard.card.symbol }}</span>
                    </div>
                    <span v-else class="text-white text-2xl font-black leading-none drop-shadow">{{ flyingCard.card.symbol }}</span>
                </div>
                <span class="absolute bottom-0.5 right-1 text-[10px] font-black opacity-90 leading-none rotate-180">{{ flyingCard.card.symbol }}</span>
            </div>
        </div>

        <!-- 特殊牌放大特效 -->
        <Transition name="fade">
            <div v-if="specialAnim" class="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none overflow-hidden">
                <div class="special-flash" :style="{ background: splashGradient }"></div>
                <div class="special-card relative" :class="wildAnimClass" :style="specialCardBg">
                    <span class="absolute top-2 left-2 text-[16px] font-black opacity-90 leading-none">{{ specialAnim.card.symbol }}</span>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div v-if="specialAnim.phase === 'color'" class="uno-oval flex items-center justify-center">
                            <span class="font-black leading-none text-7xl" :style="{ color: specialChosenHex }">{{ specialAnim.card.symbol }}</span>
                        </div>
                        <span v-else class="text-white text-7xl font-black leading-none drop-shadow">{{ specialAnim.card.symbol }}</span>
                    </div>
                    <span class="absolute bottom-2 right-2 text-[16px] font-black opacity-90 leading-none rotate-180">{{ specialAnim.card.symbol }}</span>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUnoStore } from '../../stores/unoStore.js'
import { getPlayableCards, COLOR_META, topCardOf } from '../../utils/uno/unoEngine.js'
import { playSound, unlockAudio, playColorVoice, startBGM, stopBGM } from '../../utils/uno/unoSounds.js'

const router = useRouter()
const unoStore = useUnoStore()

const pickingColor = ref(null)
const drewThisTurn = ref(false)
// 标记正在离开对局（确认返回大厅），阻止退出过程中 click 冒泡重新启动 BGM
const isLeaving = ref(false)
// 对局结束期间禁止 BGM 自动重启，直到点击“再来一局”
const bgmStoppedByGame = ref(false)
const aiTimer = ref(null)
const showConfirm = ref(false)
const showChat = ref(false)
const chatInput = ref('')
const chatScroll = ref(null)
const chatReadCount = ref(0)
const discardAnchor = ref(null)

// 出牌飞行动画
const flyingCard = ref(null)
const flyingCardStyle = ref({})
let flyTimer = null

// 弹幕
const danmakuList = ref([])

// 开局摇骰子过场（决定先后手，避免每次玩家先出）
const diceVisible = ref(false)
const diceRolling = ref(false)
const diceValue = ref(1)
const diceDone = ref(false)
const diceFirstPlayer = ref('')
let diceInterval = null
const currentRound = computed(() => unoStore.currentRoom?.currentRound ?? 0)
const diceRound = ref(-1)
function runDice() {
    const s = unoStore.gameState
    if (!s || s.phase !== 'playing') return
    diceFirstPlayer.value = s.playerNames?.[s.currentPlayerIndex] || '玩家'
    diceVisible.value = true
    diceRolling.value = true
    diceDone.value = false
    playSound('shuffle')
    let ticks = 0
    if (diceInterval) clearInterval(diceInterval)
    diceInterval = setInterval(() => {
        diceValue.value = 1 + Math.floor(Math.random() * 6)
        ticks++
        if (ticks >= 15) {
            clearInterval(diceInterval)
            diceRolling.value = false
            setTimeout(() => {
                diceDone.value = true
                // 揭示先手后再停留片刻，然后收起过场并放行 AI
                setTimeout(() => {
                    diceVisible.value = false
                    scheduleAI()
                }, 900)
            }, 500)
        }
    }, 80)
}
function maybeRunDice() {
    if (!unoStore.gameState || unoStore.gameState.phase !== 'playing') return
    const r = currentRound.value
    if (r === diceRound.value) return
    diceRound.value = r
    runDice()
}
watch(currentRound, maybeRunDice, { immediate: true })

// 特殊牌放大特效
const specialAnim = ref(null)
let specialTimer = null
let colorTimer = null
function addDanmaku(text, sender, isSelf = false, avatar = '') {
    if (!text) return
    const id = Date.now() + Math.random()
    const top = 14 + Math.random() * 48
    const duration = 9 + Math.random() * 3
    const color = isSelf ? '#60a5fa' : '#fbbf24'
    danmakuList.value.push({ id, text, sender, top, duration, color, isSelf, avatar })
    setTimeout(() => {
        danmakuList.value = danmakuList.value.filter((d) => d.id !== id)
    }, duration * 1000 + 100)
}

function playerAvatarByIndex(idx) {
    return players.value[idx]?.avatar || ''
}

function playerNameByIndex(idx) {
    return players.value[idx]?.name || `玩家${idx + 1}`
}

function getCardSourceRect(playerIndex, cardId) {
    if (playerIndex === 0 && cardId) {
        const el = document.querySelector(`.hand-row .uno-card[data-card-id="${cardId}"]`)
        if (el) return el.getBoundingClientRect()
    }
    // AI 出牌：优先从它的手牌堆位置飞出，更像真实出牌
    const oppHand = document.querySelector(`.opponents-row [data-player-hand="${playerIndex}"]`)
    if (oppHand) return oppHand.getBoundingClientRect()
    const opp = document.querySelector(`.opponents-row [data-player-idx="${playerIndex}"]`)
    if (opp) return opp.getBoundingClientRect()
    return null
}

function flyCardToDiscard(card, playerIndex, cardId) {
    const src = getCardSourceRect(playerIndex, cardId)
    const dst = discardAnchor.value?.getBoundingClientRect()
    if (!src || !dst) return
    const start = { x: src.left + src.width / 2, y: src.top + src.height / 2 }
    const end = { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 }
    const rotation = -8 + Math.random() * 16
    flyingCard.value = { card: { ...card } }
    flyingCardStyle.value = {
        left: start.x + 'px',
        top: start.y + 'px',
        width: src.width + 'px',
        height: src.height + 'px',
        transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
        opacity: 1,
        transition: 'none'
    }
    // force reflow
    void document.body.offsetHeight
    flyingCardStyle.value = {
        left: end.x + 'px',
        top: end.y + 'px',
        width: dst.width + 'px',
        height: dst.height + 'px',
        transform: `translate(-50%, -50%) scale(1.05) rotate(${rotation}deg)`,
        opacity: 1,
        transition: 'all 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
    }
    if (flyTimer) clearTimeout(flyTimer)
    flyTimer = setTimeout(() => { flyingCard.value = null }, 460)
}

// 抽牌飞行：从抽牌堆飞向对应玩家的手牌区（玩家落到底部手牌区，AI 落到对应面板）
function flyCardFromDraw(playerIndex, card) {
    const src = document.querySelector('.draw-pile')?.getBoundingClientRect()
    let dst = null
    if (playerIndex === 0) {
        dst = document.querySelector('.hand-row')?.getBoundingClientRect()
    } else {
        dst = document.querySelector(`.opponents-row [data-player-hand="${playerIndex}"]`)?.getBoundingClientRect()
            || document.querySelector(`.opponents-row [data-player-idx="${playerIndex}"]`)?.getBoundingClientRect()
    }
    if (!src || !dst) return
    const start = { x: src.left + src.width / 2, y: src.top + src.height / 2 }
    const end = { x: dst.left + dst.width / 2, y: dst.top + dst.height / 2 }
    const rotation = -8 + Math.random() * 16
    flyingCard.value = { card: card ? { ...card } : { isBack: true } }
    flyingCardStyle.value = {
        left: start.x + 'px', top: start.y + 'px',
        width: src.width + 'px', height: src.height + 'px',
        transform: 'translate(-50%, -50%) scale(1) rotate(0deg)',
        opacity: 1, transition: 'none'
    }
    void document.body.offsetHeight
    flyingCardStyle.value = {
        left: end.x + 'px', top: end.y + 'px',
        width: dst.width + 'px', height: dst.height + 'px',
        transform: `translate(-50%, -50%) scale(1.05) rotate(${rotation}deg)`,
        opacity: 1, transition: 'all 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
    }
    if (flyTimer) clearTimeout(flyTimer)
    flyTimer = setTimeout(() => { flyingCard.value = null }, 460)
}

function triggerSpecialAnim(card, color) {
    const isWild = card.type === 'wild' || card.type === 'wild4'
    // 普通功能牌直接显示当前出的颜色；变色牌先四色旋转再过渡到选色
    specialAnim.value = { card: { ...card }, color, phase: isWild ? 'spin' : 'color' }
    if (specialTimer) clearTimeout(specialTimer)
    if (colorTimer) clearTimeout(colorTimer)
    if (isWild && color) {
        colorTimer = setTimeout(() => {
            if (specialAnim.value) specialAnim.value.phase = 'color'
        }, 520)
        specialTimer = setTimeout(() => { specialAnim.value = null }, 1100)
    } else {
        specialTimer = setTimeout(() => { specialAnim.value = null }, 900)
    }
}
// 变色牌动画：四色旋转阶段用 wild-anim，普通功能牌用 plain-anim
const wildAnimClass = computed(() => {
    const a = specialAnim.value
    if (!a) return ''
    return (a.card.type === 'wild' || a.card.type === 'wild4') ? 'wild-anim' : 'plain-anim'
})
// 牌背景：四色旋转阶段显示四色彩虹，变色后过渡到选中的纯色（CSS transition 平滑）
const specialCardBg = computed(() => {
    const a = specialAnim.value
    if (!a) return { background: '#374151' }
    if (a.phase === 'color') {
        const c = a.color || a.card.color
        return { background: COLOR_META[c]?.hex || '#374151' }
    }
    return { background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #ef4444)' }
})
const specialChosenHex = computed(() => {
    const a = specialAnim.value
    return a?.color ? (COLOR_META[a.color]?.hex || '#fff') : '#fff'
})
const splashGradient = computed(() => {
    const a = specialAnim.value
    if (!a) return 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 60%)'
    if (a.phase === 'color' && a.color) {
        const hex = COLOR_META[a.color]?.hex || '#ffffff'
        return `radial-gradient(circle, ${hex}cc, transparent 65%)`
    }
    if (a.card.type === 'wild' || a.card.type === 'wild4') return 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #ef4444)'
    const hex = COLOR_META[a.card.color]?.hex || '#ffffff'
    return `radial-gradient(circle, ${hex}99, transparent 65%)`
})

// 竖屏横屏提示
const landscapeHintDismissed = ref(false)
function dismissLandscapeHint() { landscapeHintDismissed.value = true }
const showLandscapeHint = computed(() => !effectiveLandscape.value && !landscapeHintDismissed.value)

// 横屏支持：默认跟随设备朝向，桌面预览可手动切换
const forceLandscape = ref(false)
const isLandscape = ref(false)
const isWide = ref(false)
function checkOrientation() {
    if (typeof window === 'undefined') return
    isLandscape.value = window.innerWidth > window.innerHeight
    isWide.value = window.innerWidth >= 900
}
const effectiveLandscape = computed(() => forceLandscape.value || isLandscape.value)
function toggleLandscape() {
    forceLandscape.value = !forceLandscape.value
}

const room = computed(() => unoStore.currentRoom)
const gs = computed(() => unoStore.gameState)
const players = computed(() => room.value?.players || [])
const me = computed(() => players.value[0] || null)
const humanHand = computed(() => gs.value?.hands?.[0] || [])
const topCard = computed(() => (gs.value?.discard?.length ? topCardOf(gs.value) : null))
const currentColor = computed(() => gs.value?.currentColor)
const isHumanTurn = computed(() => gs.value?.currentPlayerIndex === 0 && gs.value?.phase === 'playing')
const currentPlayer = computed(() => players.value[gs.value?.currentPlayerIndex])
const lastEvent = computed(() => gs.value?.log?.[0] || '')
const winnerInfo = computed(() => gs.value?.roundResult)
const activeReplies = computed(() => unoStore.activeReplies)
const gameChatMessages = computed(() => unoStore.gameChatMessages)
const ruleName = computed(() => gs.value?.rules?.name || room.value?.rules?.name || '经典')

const ruleBadgeClass = computed(() => {
    const mode = gs.value?.ruleMode || room.value?.ruleMode || 'classic'
    const map = {
        classic: 'bg-emerald-400',
        stacking: 'bg-orange-300',
        jumpin: 'bg-blue-300',
        seveno: 'bg-purple-300',
        dump: 'bg-sky-300',
        extreme: 'bg-rose-300'
    }
    return map[mode] || 'bg-emerald-500'
})

const opponents = computed(() =>
    players.value.map((p, i) => ({
        ...p,
        index: i,
        count: gs.value?.hands?.[i]?.length || 0,
        isTurn: gs.value?.currentPlayerIndex === i,
        calledUno: gs.value?.unoCalled?.[i]
    })).filter((o) => o.index !== 0)
)

const playableIds = computed(() => {
    if (!isHumanTurn.value) return []
    return getPlayableCards(humanHand.value, topCard.value, currentColor.value).map((c) => c.id)
})

const showUnoBtn = computed(() => isHumanTurn.value && humanHand.value.length <= 2 && !gs.value?.unoCalled?.[0])
const showPass = computed(() => isHumanTurn.value && !gs.value?.dumpActive && drewThisTurn.value && playableIds.value.length === 0)
const showDrawCTA = computed(() => isHumanTurn.value && !gs.value?.dumpActive && !drewThisTurn.value && playableIds.value.length === 0)
const showDumpStop = computed(() => isHumanTurn.value && gs.value?.dumpActive)
function stopDumpNow() {
    if (!isHumanTurn.value) return
    unoStore.stopDump(0)
    scheduleAI()
}
const colorChipStyle = computed(() => ({ background: currentColor.value ? COLOR_META[currentColor.value]?.hex : '#fff' }))
const unreadChat = computed(() => Math.max(0, gameChatMessages.value.length - chatReadCount.value))

function isImageAvatar(avatar) {
    if (!avatar) return false
    return avatar.startsWith('/') || avatar.startsWith('data:image') || avatar.startsWith('http')
}

function cardBg(card) {
    if (!card) return { background: '#374151' }
    if (card.color === 'wild') return { background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #ef4444)' }
    return { background: COLOR_META[card.color].hex }
}

function cardTextClass(card) {
    if (!card) return 'text-white'
    return card.color === 'yellow' ? 'text-gray-900' : 'text-white'
}

function cardSymbolColor(card) {
    if (!card || card.color === 'wild') return '#ffffff'
    return COLOR_META[card.color].hex
}

function isPlayable(id) {
    return playableIds.value.includes(id)
}

function onHumanCardClick(card) {
    if (!isHumanTurn.value || pickingColor.value) return
    if (!playableIds.value.includes(card.id)) return
    if (card.type === 'wild' || card.type === 'wild4') {
        pickingColor.value = card.id
        return
    }
    playNow(card.id, null)
}

function playNow(cardId, color) {
    const card = humanHand.value.find(c => c.id === cardId)
    if (card) flyCardToDiscard(card, 0, cardId)
    unoStore.playCard(0, cardId, color)
    drewThisTurn.value = false
    scheduleAI()
}

function chooseColor(color) {
    const cardId = pickingColor.value
    pickingColor.value = null
    if (cardId) {
        playNow(cardId, color)
        playColorVoice(color)
    }
}

function cancelColor() {
    pickingColor.value = null
}

function onDraw() {
    if (!isHumanTurn.value || pickingColor.value) return
    const c = unoStore.drawOne(0)
    if (c) {
        drewThisTurn.value = true
        // 抽到仍无法出的牌：标准 UNO 下回合自动结束，杜绝“主动过”导致的卡死
        nextTick(() => {
            if (playableIds.value.length === 0) {
                setTimeout(() => { if (isHumanTurn.value) humanPass() }, 700)
            }
        })
    } else {
        humanPass()
    }
}

function humanPass() {
    if (!isHumanTurn.value) return
    unoStore.passTurn(0)
    drewThisTurn.value = false
    scheduleAI()
}

function callUnoNow() {
    unoStore.callUno(0)
    playSound('uno', { voiceEnabled: unoStore.voiceEnabled })
}

function backToLobby() {
    showConfirm.value = true
}

function confirmBack() {
    isLeaving.value = true
    stopBGM()
    showConfirm.value = false
    unoStore.returnToLobby()
    // 已在同路由或重复点击时会被 Vue Router 拒绝为 NavigationDuplicated，需吞掉避免控制台报错
    router.push('/games/uno-lobby').catch(() => {})
}

async function playAgain() {
    await unoStore.startNewGame()
    drewThisTurn.value = false
    bgmStoppedByGame.value = false
    // 重置离开标记，避免“再来一局”后 BGM 起不来或被拦截点击
    isLeaving.value = false
    startBGM()
    scheduleAI()
    // 确保回到游戏页（若当前已在 /games/uno 则触发 NavigationDuplicated，需吞掉）
    router.push('/games/uno').catch(() => {})
}

function toggleChat() {
    showChat.value = !showChat.value
    if (showChat.value) {
        nextTick(() => {
            chatReadCount.value = gameChatMessages.value.length
            scrollChatBottom()
        })
    }
}

function scrollChatBottom() {
    if (chatScroll.value) chatScroll.value.scrollTop = chatScroll.value.scrollHeight
}

async function sendChat() {
    const text = chatInput.value.trim()
    if (!text) return
    chatInput.value = ''
    await unoStore.sendGameChat(text)
    nextTick(() => {
        chatReadCount.value = gameChatMessages.value.length
        scrollChatBottom()
    })
}

// AI 出牌节奏：放慢，让玩家看清每一次出牌（思考停顿 + 飞行/特效完整展示）
const AI_STEP_DELAY = 1500

// 驱动 AI 回合的定时器链
function scheduleAI() {
    if (aiTimer.value) clearTimeout(aiTimer.value)
    const s = unoStore.gameState
    if (!s || s.phase !== 'playing') return
    const p = unoStore.currentRoom?.players[s.currentPlayerIndex]
    if (!p || !p.isAI) return
    aiTimer.value = setTimeout(() => {
        unlockAudio() // AI 自动行动前解锁音频，避免音效被浏览器静默拦截
        unoStore.aiStep()
        // 抢出模式额外检查
        if (s.rules?.jumpIn) unoStore.checkJumpIn()
        if (unoStore.gameState?.phase === 'playing') scheduleAI()
    }, AI_STEP_DELAY)
}

watch(() => [gs.value?.currentPlayerIndex, gs.value?.phase], () => {
    drewThisTurn.value = false
    if (!diceDone.value) return // 摇骰子过场未结束前不排 AI
    scheduleAI()
})

// 对局结束：停止 BGM 并播放胜负音效；结算期间禁止自动重启
watch(() => gs.value?.phase, (phase) => {
    if (phase === 'finished') {
        bgmStoppedByGame.value = true
        stopBGM()
        const win = gs.value?.winnerIndex === 0
        playSound(win ? 'win' : 'lose')
    } else if (phase === 'playing') {
        bgmStoppedByGame.value = false
    }
})

// 音效与聊天监听
watch(() => unoStore.lastAction, (action) => {
    if (!action) return
    const type = action.type
    if (type === 'play') {
        const card = action.card
        if (!card) return
        // 出牌飞行动画：人已经在 playNow 里飞了，这里只飞 AI
        if (action.playerIndex !== 0) {
            flyCardToDiscard(card, action.playerIndex ?? 0, action.cardId)
        }
        if (card.type === 'skip') playSound('skip')
        else if (card.type === 'reverse') playSound('reverse')
        else if (card.type === 'draw2') playSound('draw2')
        else if (card.type === 'wild4') playSound('wild4')
        else if (card.type === 'wild') playSound('play')
        else playSound('play')
        // 万能牌选色后喊对应颜色人声：延迟到特效旋转阶段结束，避免与 wild4 人声重叠
        if ((card.type === 'wild' || card.type === 'wild4') && action.color) {
            setTimeout(() => playColorVoice(action.color), card.type === 'wild4' ? 720 : 520)
        }
        // 特殊牌放大特效
        if (['skip', 'reverse', 'draw2', 'wild4', 'wild'].includes(card.type)) {
            setTimeout(() => triggerSpecialAnim(card, action.color), 360)
        }
        // AI 或玩家出牌后喊 UNO：同步播放 UNO 音效
        if (action.calledUno) {
            setTimeout(() => playSound('uno', { voiceEnabled: unoStore.voiceEnabled }), 420)
        }
    } else if (type === 'draw') {
        playSound('draw')
        flyCardFromDraw(action.playerIndex ?? 0, action.card)
    } else if (type === 'uno') {
        playSound('uno')
    } else if (type === 'win') {
        playSound('win')
    } else if (type === 'lose') {
        playSound('lose')
    } else if (type === 'chat') {
        playSound('chat')
    }
}, { deep: true })

// 背景音乐开关随 store 变化
watch(() => unoStore.bgmEnabled, (on) => {
    if (on) startBGM()
    else stopBGM()
})

// 新聊天：自动滚动 + 生成弹幕
watch(gameChatMessages, (msgs, prevMsgs) => {
    const last = msgs[msgs.length - 1]
    const prevLen = prevMsgs?.length || 0
    if (last && msgs.length > prevLen) {
        const isSelf = last.role === 'user'
        addDanmaku(last.content, last.sender, isSelf, playerAvatarByIndex(isSelf ? 0 : (last.playerIdx ?? -1)))
    }
    if (showChat.value) {
        nextTick(() => {
            chatReadCount.value = gameChatMessages.value.length
            scrollChatBottom()
        })
    }
}, { deep: true })

onMounted(() => {
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)
    if (!room.value) {
        router.replace('/games/uno-lobby')
        return
    }
    if (!gs.value) {
        unoStore.startGame()
    }
    nextTick(() => {
        // 首次交互前浏览器会拦截自动播放，这里尝试启动 BGM，后续点击会补启
        startBGM()
        // 摇骰子过场（内部结束后放行 AI 调度）
        maybeRunDice()
    })
})

function onRootClick() {
    // 正在离开（退出确认已触发）时不补启 BGM，避免 click 冒泡重新 start 已停的音乐
    if (isLeaving.value) return
    // 对局已结束：结算弹窗期间不再重启 BGM，等“再来一局”后再起
    if (bgmStoppedByGame.value || gs.value?.phase === 'finished') return
    unlockAudio()
    startBGM()
}

onUnmounted(() => {
    if (aiTimer.value) clearTimeout(aiTimer.value)
    window.removeEventListener('resize', checkOrientation)
    window.removeEventListener('orientationchange', checkOrientation)
    stopBGM()
})
</script>

<style scoped>
/* ===== 女生向柔和牌桌：奶油底色 + 椭圆桌布 +  pastel 光晕 ===== */
.uno-game {
    max-width: 600px;
    margin: 0 auto;
    position: relative;
    background:
        radial-gradient(120% 80% at 80% 10%, rgba(251, 113, 133, 0.10) 0%, transparent 50%),
        radial-gradient(120% 80% at 10% 90%, rgba(167, 243, 208, 0.22) 0%, transparent 50%),
        radial-gradient(120% 80% at 50% 50%, rgba(253, 230, 138, 0.10) 0%, transparent 55%),
        linear-gradient(180deg, #fffbf5 0%, #faf6f0 100%);
    overflow: hidden;
}
.uno-game::before {
    content: '';
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    pointer-events: none;
    z-index: 0;
    width: 340px; height: 340px;
    top: -100px; right: -100px;
    background: radial-gradient(circle, rgba(244, 114, 182, 0.18), transparent 70%);
}
.uno-game::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    pointer-events: none;
    z-index: 0;
    width: 360px; height: 360px;
    bottom: -120px; left: -120px;
    background: radial-gradient(circle, rgba(167, 243, 208, 0.28), transparent 70%);
}
/* 柔和颗粒 + 暗角 */
.uno-game > .uno-grain {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background:
        radial-gradient(circle at 50% 45%, transparent 40%, rgba(120, 113, 108, 0.06) 100%),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.04; mix-blend-mode: multiply;
}
/* 椭圆桌布 */
.table-felt {
    position: absolute;
    width: 92%; height: 54%;
    top: 48%; left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(ellipse at center, rgba(220, 252, 231, 0.55) 0%, rgba(187, 247, 208, 0.35) 50%, transparent 72%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
}

/* ===== 顶部栏：奶油玻璃 ===== */
.glass-bar {
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(231, 229, 228, 0.8);
}

/* ===== 对手面板：软糯卡片 ===== */
.opp-panel {
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 6px 18px rgba(120, 113, 108, 0.12), 0 1px 3px rgba(120, 113, 108, 0.08);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.opp-panel:hover { transform: translateY(-2px); }
.opp-turn {
    background: rgba(255, 241, 242, 0.92);
    border-color: rgba(251, 113, 133, 0.55);
    box-shadow: 0 0 20px rgba(251, 113, 133, 0.28), 0 6px 18px rgba(120, 113, 108, 0.12);
    animation: turnPulse 1.8s ease-in-out infinite;
}
@keyframes turnPulse {
    0%, 100% { box-shadow: 0 0 14px rgba(251, 113, 133, 0.20), 0 6px 18px rgba(120, 113, 108, 0.12); }
    50% { box-shadow: 0 0 26px rgba(251, 113, 133, 0.40), 0 6px 18px rgba(120, 113, 108, 0.12); }
}

/* ===== 牌面：扁平现代 UNO 风格，去掉蓬起来的浮雕感 ===== */
.uno-card {
    width: 56px; height: 82px;
    border-radius: 14px;
    position: relative;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 4px 10px rgba(68, 64, 60, 0.14);
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
}
.uno-oval {
    width: 70%; height: 70%; border-radius: 50%; background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.uno-playable {
    box-shadow: 0 0 0 2px rgba(251, 113, 133, 0.65), 0 8px 18px rgba(68, 64, 60, 0.18);
}
.uno-playable:hover { transform: translateY(-10px) scale(1.04); z-index: 10; }
.uno-unplayable { opacity: 0.42; filter: saturate(0.5); }
.uno-back {
    background: linear-gradient(135deg, #fb7185, #e11d48);
    border: 2px solid rgba(255, 255, 255, 0.9);
}
.uno-back-mini {
    width: 18px; height: 27px; border-radius: 5px;
    background: linear-gradient(135deg, #fb7185, #e11d48);
    border: 1.5px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 2px 4px rgba(68, 64, 60, 0.15);
}

/* ===== 中央牌堆：柔和投影 ===== */
.center-pile::before {
    content: '';
    position: absolute;
    width: 240px; height: 140px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(ellipse at center, rgba(120, 113, 108, 0.12), transparent 70%);
    border-radius: 50%;
    pointer-events: none;
    z-index: -1;
}
.draw-pile:active .uno-back { transform: scale(0.96); }

/* ===== 手牌区：奶油玻璃 dock ===== */
.hand-row {
    justify-content: flex-start;
    padding: 0.6rem 0.75rem 0.75rem;
    background: rgba(255, 255, 255, 0.62);
    border-top: 1px solid rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -6px 24px rgba(120, 113, 108, 0.08);
}
.hand-row > .uno-card:first-child { margin-left: auto; }
.hand-row > .uno-card:last-child { margin-right: auto; }

/* ===== 过渡 ===== */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s ease, opacity 0.25s ease; }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); opacity: 0; }

/* ===== 特殊牌放大特效（柔和版） ===== */
@keyframes specialPop {
    0% { transform: scale(0.3) rotate(-14deg); opacity: 0; }
    30% { transform: scale(1.28) rotate(7deg); opacity: 1; }
    65% { transform: scale(1.08) rotate(-3deg); opacity: 1; }
    100% { transform: scale(1.45) rotate(0deg); opacity: 0; }
}
@keyframes specialWild {
    0%   { transform: scale(0.3) rotate(0deg);    opacity: 0; }
    20%  { transform: scale(1.34) rotate(220deg); opacity: 1; }
    48%  { transform: scale(1.26) rotate(356deg); opacity: 1; }
    54%  { transform: scale(1.26) rotate(360deg); opacity: 1; }
    80%  { transform: scale(1.44) rotate(360deg); opacity: 1; }
    100% { transform: scale(1.56) rotate(360deg); opacity: 0; }
}
@keyframes specialFlash {
    0% { opacity: 0; transform: scale(0.6); }
    25% { opacity: 0.45; transform: scale(1.1); }
    100% { opacity: 0; transform: scale(1.6); }
}
.special-card {
    width: 118px; height: 174px; border: 3px solid #fff; border-radius: 18px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    transition: background 0.45s ease, box-shadow 0.45s ease;
}
.plain-anim { animation: specialPop 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.wild-anim { animation: specialWild 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.special-card.wild-anim { box-shadow: 0 0 55px 18px rgba(255, 255, 255, 0.45); }
.special-flash { position: absolute; inset: 0; animation: specialFlash 0.9s ease-out forwards; }

/* 弃牌堆落牌弹入 */
.cardPop-enter-active { animation: cardPopIn 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.cardPop-leave-active { animation: cardPopOut 0.15s ease forwards; position: absolute; }
@keyframes cardPopIn {
    0% { transform: scale(0.5) rotate(-12deg); opacity: 0; }
    60% { transform: scale(1.12) rotate(5deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes cardPopOut { to { transform: scale(0.8); opacity: 0; } }

/* 手牌发牌入场 */
.deal-in { animation: dealIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
@keyframes dealIn {
    0% { transform: translateY(40px) scale(0.6); opacity: 0; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
}

/* 骰子摇晃 */
.dice-shake { animation: diceShake 0.1s linear infinite; }
@keyframes diceShake {
    0% { transform: rotate(-12deg) translateY(-3px); }
    50% { transform: rotate(12deg) translateY(3px); }
    100% { transform: rotate(-12deg) translateY(-3px); }
}

/* 出牌飞行动画 */
.flying-card { transform: translate(-50%, -50%); z-index: 160; }

/* 弹幕 */
@keyframes danmaku {
    0% { transform: translateX(110vw); }
    100% { transform: translateX(-110%); }
}
.animate-danmaku { animation: danmaku linear forwards; white-space: nowrap; }
.danmaku-layer { pointer-events: none; }

/* 滚动条隐藏 */
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }

@media (prefers-reduced-motion: reduce) {
    .plain-anim { animation-duration: 0.4s; }
    .wild-anim { animation-duration: 0.7s; }
    .special-flash { animation-duration: 0.4s; }
    .deal-in, .cardPop-enter-active, .cardPop-leave-active, .dice-shake, .animate-danmaku { animation: none; }
    .opp-panel, .opp-turn { animation: none; transition: none; }
    .flying-card { transition-duration: 0.15s !important; }
}

/* ===== 横屏 / 桌面宽屏牌桌布局 ===== */
.uno-land, .uno-wide { max-width: none; }
.uno-land .opponents-row,
.uno-wide .opponents-row { flex-wrap: wrap; justify-content: center; gap: 1rem; overflow: visible; }
.uno-land .uno-card,
.uno-wide .uno-card { width: 64px; height: 94px; }
.uno-land .uno-back,
.uno-wide .uno-back { width: 92px !important; height: 134px !important; }
.uno-land .center-pile,
.uno-wide .center-pile { gap: 3.5rem; }
.uno-land .hand-row,
.uno-wide .hand-row { justify-content: center; gap: 0.55rem; border-radius: 24px 24px 0 0; padding: 0.75rem 1.25rem; }
.uno-land .hand-row .uno-card,
.uno-wide .hand-row .uno-card { width: 70px; height: 104px; }
</style>
