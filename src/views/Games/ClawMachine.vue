<template>
    <div class="claw-machine-page relative w-full h-full overflow-hidden bg-[#f0f9ff]">
        <!-- ============================================================ -->
        <!-- 顶部导航栏：悬浮玻璃 -->
        <!-- ============================================================ -->
        <div
            class="absolute top-0 inset-x-0 h-[50px] flex items-center justify-between px-3 z-50 bg-slate-900/70 backdrop-blur-md shadow-sm">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-gamepad"></i>
                <span>娃娃机</span>
            </h1>
            <div class="flex items-center gap-2">
                <button @click="showExhibition = true"
                    class="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-white text-xs">
                    <i class="fa-solid fa-trophy"></i>
                    <span>{{ clawStore.exhibitionCount }}</span>
                </button>
                <button @click="openRecharge" class="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-white text-xs">
                    <i class="fa-solid fa-coins"></i>
                    <span>{{ clawStore.coins }}</span>
                </button>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段1: 邀请角色 -->
        <!-- ============================================================ -->
        <div v-if="clawStore.gamePhase === 'idle' || clawStore.gamePhase === 'inviting'"
            class="absolute inset-0 z-10 overflow-y-auto px-4 py-4 pt-[66px]">
            <div class="text-center mb-6">
                <img src="/claw-machine-assets/machines-v2/plush.png" class="w-48 h-auto mx-auto mb-3 drop-shadow-xl" />
                <h2 class="text-2xl font-bold text-sky-700 mb-2">邀请好友一起玩</h2>
                <p class="text-sm text-gray-500">从通讯录选择一个角色，共同抓娃娃</p>
            </div>

            <!-- 已选角色 -->
            <div v-if="clawStore.invitedCharId" class="mb-4 p-4 bg-white rounded-2xl shadow flex items-center gap-3">
                <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-14 h-14 rounded-full object-cover bg-gray-100"
                    @error="onAvatarError" />
                <div class="flex-1">
                    <div class="font-bold text-gray-800">{{ getCharDisplayName(clawStore.invitedCharId) }}</div>
                    <div class="text-xs text-gray-400">已邀请</div>
                </div>
                <button @click="clawStore.invitedCharId = null; clawStore.invitedCharName = null"
                    class="px-3 py-1 rounded-full bg-red-50 text-red-500 text-xs">更换</button>
            </div>

            <!-- 角色列表 -->
            <div v-if="!clawStore.invitedCharId" class="space-y-2">
                <div v-if="contactList.length === 0" class="text-center text-gray-400 py-8">
                    <i class="fa-solid fa-address-book text-4xl mb-2"></i>
                    <p>通讯录还没有角色</p>
                    <p class="text-xs mt-1">先去微信添加角色吧</p>
                </div>
                <div v-for="char in contactList" :key="char.id" @click="selectChar(char)"
                    class="p-3 bg-white rounded-2xl shadow flex items-center gap-3 active:scale-95 transition-transform cursor-pointer">
                    <img :src="char.avatar" class="w-12 h-12 rounded-full object-cover bg-gray-100" @error="onAvatarError" />
                    <div class="flex-1">
                        <div class="font-bold text-gray-800">{{ char.displayName }}</div>
                        <div class="text-xs text-gray-400 truncate">{{ (char.prompt || '').slice(0, 40) }}...</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300"></i>
                </div>
            </div>

            <!-- 下一步按钮 -->
            <button v-if="clawStore.invitedCharId" @click="goToSelecting"
                class="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-600 text-white font-bold shadow-lg active:scale-95 transition-transform">
                选择娃娃机 <i class="fa-solid fa-arrow-right ml-1"></i>
            </button>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段2: 选机子 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'selecting'" class="absolute inset-0 z-10 overflow-y-auto px-4 py-4 pt-[66px]">
            <div class="flex items-center gap-2 mb-4">
                <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-8 h-8 rounded-full bg-gray-100"
                    @error="onAvatarError" />
                <span class="text-sm text-gray-500">和 {{ getCharDisplayName(clawStore.invitedCharId) }} 一起玩</span>
            </div>

            <h2 class="text-lg font-bold text-sky-700 mb-3">选择娃娃机</h2>

            <div class="grid grid-cols-2 gap-3">
                <div v-for="machine in clawStore.MACHINES" :key="machine.id"
                    @click="enterMachine(machine.id)"
                    class="bg-white rounded-2xl shadow-lg overflow-hidden active:scale-95 transition-transform cursor-pointer">
                    <div class="h-[120px] relative overflow-hidden bg-gray-50">
                        <img :src="machine.image" class="w-full h-full object-cover object-top" />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
                        <div class="absolute bottom-1 right-1 flex gap-0.5 bg-white/70 rounded-full px-1.5 py-0.5">
                            <template v-for="(doll, i) in machine.dolls.slice(0, 3)" :key="i">
                                <img v-if="doll.image" :src="doll.image" class="w-6 h-6 object-contain" />
                            </template>
                        </div>
                    </div>
                    <div class="p-2.5">
                        <h3 class="font-bold text-sm">{{ machine.name }}</h3>
                        <p class="text-xs text-gray-400 mb-1.5 truncate">{{ machine.description }}</p>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-orange-500 font-bold">{{ machine.cost }}币/次</span>
                            <button v-if="machine.dolls.find(d => d.isCustom)" @click.stop="openCustomUpload(machine.id)"
                                class="text-xs text-blue-500">
                                <i class="fa-solid fa-upload"></i> 自定义
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段3/4/5: 机台游戏界面（投币、选择、游玩、结果都在这） -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'playing' || clawStore.gamePhase === 'result'"
            class="absolute inset-0 z-0">

            <!-- 机台全屏底图 -->
            <div class="machine-frame absolute inset-0 overflow-hidden" @click.self="onSabotage">
                <img :src="clawStore.currentMachine?.image"
                    class="machine-img absolute left-1/2 -translate-x-1/2 h-[152%] -top-[52%] w-auto max-w-none"
                    draggable="false" />
                <div class="absolute inset-0 pointer-events-none z-[1]"
                    style="background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.14) 100%);"></div>
            </div>

            <!-- 顶部信息层：头像、名字 -->
            <div class="absolute top-[58px] inset-x-0 px-3 z-40 flex items-center justify-between pointer-events-none">
                <!-- 用户 -->
                <div class="pointer-events-auto flex flex-col items-center gap-0.5 bg-black/20 backdrop-blur-sm rounded-2xl px-2.5 py-1.5">
                    <img :src="userProfile.avatar || defaultAvatar" class="w-9 h-9 rounded-full object-cover border-2 border-white/70" @error="onAvatarError" />
                    <span class="text-[10px] text-white font-medium drop-shadow max-w-[56px] truncate">{{ userProfile.name || '我' }}</span>
                </div>

                <!-- 角色 -->
                <div class="pointer-events-auto flex flex-col items-center gap-0.5 bg-black/20 backdrop-blur-sm rounded-2xl px-2.5 py-1.5">
                    <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-9 h-9 rounded-full object-cover border-2 border-sky-300/70" @error="onAvatarError" />
                    <span class="text-[10px] text-white font-medium drop-shadow max-w-[56px] truncate">{{ getCharDisplayName(clawStore.invitedCharId) || 'TA' }}</span>
                </div>
            </div>

            <!-- 左侧竖直倒计时（渐变：天蓝 → 橙红，时间越近越紧迫） -->
            <div v-if="isUserPlaying && clawStore.clawState === 'idle'"
                class="absolute left-3 top-[120px] h-[180px] w-4 bg-black/20 rounded-full overflow-hidden z-30 backdrop-blur-sm border border-white/10 shadow-lg">
                <div class="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-100 ease-linear"
                    :style="{
                        height: countdownPct + '%',
                        background: countdownGradient,
                        boxShadow: `0 0 14px ${countdownGlowColor}`
                    }"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-[10px] font-black text-white drop-shadow-md rotate-90 whitespace-nowrap">{{ Math.ceil(timeLeft) }}s</span>
                </div>
            </div>

            <!-- 加油 / 互动气泡 -->
            <transition-group name="pop" tag="div" class="absolute inset-0 pointer-events-none z-30">
                <div v-for="b in activeBubbles" :key="b.id"
                    class="absolute px-3 py-1.5 rounded-full text-xs font-bold text-sky-600 bg-white/90 shadow-md backdrop-blur-sm border border-sky-100 whitespace-nowrap"
                    :style="{ left: b.x + '%', top: b.y + '%', transform: 'translate(-50%, -50%)' }">
                    {{ b.text }}
                </div>
            </transition-group>

            <!-- 点击屏幕的涟漪特效 -->
            <transition-group name="ripple" tag="div" class="absolute inset-0 pointer-events-none z-25">
                <div v-for="r in ripples" :key="r.id"
                    class="absolute rounded-full border-2 border-white/80 ripple-ring"
                    :style="{ left: r.x + '%', top: r.y + '%' }"></div>
            </transition-group>

            <!-- 机内玩偶 -->
            <div class="absolute inset-0 z-10">
                <div v-for="doll in clawStore.machineLayout" :key="doll.layoutId"
                    class="absolute will-change-transform"
                    :class="caughtDoll?.layoutId === doll.layoutId ? 'opacity-0' : ''"
                    :style="{
                        left: doll.x + '%',
                        top: doll.y + '%',
                        transform: `translate(-50%, -50%) rotate(${doll.rotation}deg) scale(${doll.scale})`,
                        zIndex: doll.zIndex,
                        transition: 'transform 0.3s ease-out',
                    }">
                    <img :src="doll.image" class="w-24 h-24 object-contain drop-shadow-xl" draggable="false" />
                </div>
            </div>

            <!-- 准星 -->
            <div v-if="targetDoll"
                class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[22]"
                :style="{
                    left: targetDoll.x + '%',
                    top: targetDoll.y + '%',
                }">
                <div class="w-24 h-24 rounded-full border-2 border-sky-400/70 bg-sky-400/10 animate-pulse"></div>
            </div>

                <!-- 被抓中的玩偶：跟随爪子上升（位于爪子手指下方） -->
                <div v-if="caughtDoll && (clawStore.clawState === 'grabbing' || clawStore.clawState === 'rising')"
                    class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    :style="{
                        left: clawStore.clawX + '%',
                        top: (clawStore.clawY + clawHookOffset + 18) + '%',
                        zIndex: 29,
                        transform: `translate(-50%, -50%) scale(${caughtDoll.scale})`,
                    }">
                <img :src="caughtDoll.image" class="w-24 h-24 object-contain drop-shadow-xl" draggable="false" />
            </div>

            <!-- 爪子 + 绳索 -->
            <div class="absolute inset-0 z-30 pointer-events-none">
                <!-- 绳索：从顶部轨道到爪子连接点，与爪子顶端对齐 -->
                <div class="absolute -translate-x-1/2 rounded-full"
                    :style="{
                        left: clawStore.clawX + '%',
                        top: '0%',
                        width: '6px',
                        height: Math.max(0, clawStore.clawY + clawHookOffset) + '%',
                        background: 'linear-gradient(to right, #64748b, #e2e8f0 35%, #f8fafc 50%, #e2e8f0 65%, #94a3b8)',
                        boxShadow: '1px 0 4px rgba(0,0,0,0.3), inset 0 0 2px rgba(255,255,255,0.5)',
                    }">
                </div>
                <!-- 连接环 -->
                <div class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full z-[31]"
                    :style="{
                        left: clawStore.clawX + '%',
                        top: (clawStore.clawY + clawHookOffset) + '%',
                        width: '12px',
                        height: '12px',
                        background: 'radial-gradient(circle at 30% 30%, #f1f5f9, #94a3b8)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }">
                </div>
                <!-- 爪子本体：钩子中心与连接环/钢丝终点对齐 -->
                <div class="absolute -translate-x-1/2"
                    :style="{
                        left: clawStore.clawX + '%',
                        top: (clawStore.clawY + clawHookOffset) + '%',
                        transition: isClawAnimating ? 'none' : 'left 0.12s ease-out',
                        filter: 'drop-shadow(0 12px 18px rgba(0,0,0,0.5))',
                    }">
                    <div class="absolute -inset-3 rounded-full bg-white/25 blur-xl -z-10 animate-pulse"></div>
                    <img src="/claw-machine-assets/claw/claw.png"
                        class="w-44 h-auto object-contain -mt-1"
                        :class="{
                            'claw-open': clawStore.clawState === 'dropping',
                            'claw-grip': clawStore.clawState === 'grabbing' || clawStore.clawState === 'rising',
                        }"
                        draggable="false" />
                </div>
            </div>

            <!-- 操控者提示 -->
            <div class="absolute top-28 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow flex items-center gap-1.5 backdrop-blur-sm z-30"
                :class="clawStore.controller === 'ai'
                    ? 'bg-sky-100/90 text-sky-600'
                    : 'bg-sky-50/90 text-sky-700'">
                <i v-if="clawStore.controller === 'ai'" class="fa-solid fa-robot"></i>
                <i v-else class="fa-solid fa-gamepad"></i>
                <span>{{ controllerText }}</span>
            </div>

            <!-- AI 思考提示 -->
            <div v-if="clawStore.aiThinking" class="absolute top-36 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/90 text-xs text-gray-500 shadow backdrop-blur-sm z-30">
                <i class="fa-solid fa-spinner fa-spin mr-1"></i>{{ getCharDisplayName(clawStore.invitedCharId) }} 思考中...
            </div>

            <!-- 底部控制面板区（上移对齐机台控制面板） -->
            <div class="absolute bottom-[6%] inset-x-0 h-[26%] z-40 pointer-events-none flex items-end justify-between px-6 pb-2">
                <!-- 拖拽摇杆 -->
                <div v-if="isUserPlaying && clawStore.clawState === 'idle'"
                    class="pointer-events-auto flex flex-col items-center">
                    <div ref="joystickBase"
                        class="joystick-base relative w-[84px] h-[84px] rounded-full flex items-center justify-center touch-none"
                        @pointerdown="onJoystickStart"
                        @pointermove="onJoystickMove"
                        @pointerup="onJoystickEnd"
                        @pointerleave="onJoystickEnd"
                        @pointercancel="onJoystickEnd">
                        <div class="joystick-hollow absolute w-[60px] h-[60px] rounded-full"></div>
                        <div class="joystick-stick absolute w-11 h-11 rounded-full shadow-lg border-2 border-white/60 transition-transform duration-75 ease-out"
                            :style="joystickStyle"></div>
                    </div>
                    <span class="text-[10px] text-white/80 mt-1.5 drop-shadow font-medium">拖动移动</span>
                </div>

                <!-- 占位（非用户操作时） -->
                <div v-else class="w-[84px]"></div>

                <!-- 投币 / 抓取按钮 -->
                <div class="pointer-events-auto flex flex-col items-center gap-2">
                    <!-- 未投币：显示投币按钮 -->
                    <template v-if="!clawStore.playMode">
                        <button @click="insertCoinAndStart"
                            :disabled="!clawStore.canPlay"
                            class="coin-btn"
                            :class="clawStore.canPlay ? '' : 'opacity-60'">
                            <i class="fa-solid fa-coins text-lg mb-0.5"></i>
                            <span class="text-sm font-bold">{{ clawStore.canPlay ? `投币 (${clawStore.currentMachine?.cost || 1})` : '币不足' }}</span>
                        </button>
                        <span class="text-[10px] text-white/70 drop-shadow">余额 {{ clawStore.coins }}</span>
                    </template>

                    <!-- 已投币：显示抓取按钮 -->
                    <button v-else-if="isUserPlaying && clawStore.clawState === 'idle'" @click.stop="handleDrop"
                        class="grab-btn">
                        <i class="fa-solid fa-hand-rock text-xl mb-0.5"></i>
                        <span class="text-sm font-bold">抓</span>
                    </button>
                </div>
            </div>

            <!-- AI 操作时：全屏透明点击层用于捣乱 -->
            <div v-if="clawStore.controller === 'ai' && clawStore.clawState !== 'idle'"
                class="absolute inset-0 z-[35] bg-transparent"
                @click="onSabotage">
            </div>

            <!-- AI 操作提示 -->
            <div v-if="clawStore.controller === 'ai' && clawStore.clawState !== 'idle'"
                class="absolute bottom-[38%] left-0 right-0 text-center z-40 pointer-events-none">
                <span class="hint-badge">{{ getClawStateText() }} · 点击屏幕捣乱</span>
            </div>

            <!-- 聊天开关：屏幕右侧中间 -->
            <button v-if="!chatOpen" @click="chatOpen = true"
                class="absolute top-1/2 right-3 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-white/90 backdrop-blur shadow-lg border border-white/60 flex items-center justify-center text-sky-500 pointer-events-auto active:scale-95 transition-transform">
                <i class="fa-solid fa-comment-dots text-lg"></i>
                <span v-if="unreadCount > 0" class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">{{ unreadCount }}</span>
            </button>

            <!-- UNO/麻将式右侧悬浮聊天面板（垂直居中，更大更明显） -->
            <Transition name="slide-right">
                <div v-if="chatOpen" @click.stop
                    class="absolute top-1/2 right-3 -translate-y-1/2 z-[60] flex flex-col
                           w-[42%] min-w-[220px] max-w-[320px] h-[60%] max-h-[520px]
                           bg-white/92 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/70 p-3 pointer-events-auto">
                    <div class="flex justify-between items-center mb-2 pb-2 border-b border-sky-100">
                        <h3 class="text-sky-600 text-xs font-black flex items-center gap-1.5">
                            <i class="fa-solid fa-comments"></i> 局内聊天
                        </h3>
                        <button @click="chatOpen = false" class="text-sky-300 hover:text-sky-500 transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-sky-50">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div ref="chatContainer" class="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 scrollbar-none">
                        <div v-if="visibleChatMessages.length === 0" class="text-center text-gray-400 text-[10px] py-6">
                            说点什么，{{ getCharDisplayName(clawStore.invitedCharId) || 'TA' }} 会回应你
                        </div>
                        <div v-for="msg in visibleChatMessages" :key="msg.id" :class="msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                            <div class="text-[9px] text-gray-400 mb-0.5 px-0.5">{{ msg.role === 'user' ? (userProfile.name || '我') : (getCharDisplayName(clawStore.invitedCharId) || 'TA') }}</div>
                            <div :class="msg.role === 'user' ? 'bg-sky-500 text-white rounded-2xl rounded-tr-sm' : 'bg-gray-100 text-gray-700 rounded-2xl rounded-tl-sm'"
                                class="px-3 py-2 text-[11px] shadow-sm max-w-[95%] break-words leading-relaxed">
                                {{ msg.content }}
                            </div>
                        </div>
                        <div v-if="clawStore.aiThinking && streamingText" class="flex flex-col items-start">
                            <div class="text-[9px] text-gray-400 mb-0.5 px-0.5">{{ getCharDisplayName(clawStore.invitedCharId) || 'TA' }}</div>
                            <div class="max-w-[95%] px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-100 text-gray-700 text-[11px]">
                                {{ streamingText }}<span class="animate-pulse">▋</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2 bg-sky-50/70 p-2.5 rounded-2xl">
                        <input v-model="chatInput" @keyup.enter="sendChat" placeholder="给TA发消息..."
                            class="flex-1 bg-white border border-sky-100 rounded-xl px-3 py-2 text-gray-700 text-[11px] outline-none focus:border-sky-300 transition-colors" />
                        <button @click="sendChat" :disabled="!chatInput.trim() || clawStore.aiThinking"
                            class="w-full bg-sky-500 hover:bg-sky-600 text-white py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-all shadow-md disabled:opacity-50">
                            发送
                        </button>
                    </div>
                </div>
            </Transition>

            <!-- 投币后中央模式选择弹窗 -->
            <div v-if="showModeSelector"
                class="absolute inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                @click.self="cancelModeSelector">
                <div class="bg-white/95 backdrop-blur-xl rounded-3xl p-5 w-[86%] max-w-[340px] shadow-2xl border border-white/70">
                    <h3 class="text-center text-lg font-black text-gray-800 mb-1">谁来操控？</h3>
                    <p class="text-center text-xs text-gray-400 mb-5">已投币 {{ clawStore.currentMachine?.cost || 1 }} 枚</p>
                    <!-- 两个长条文字选择 -->
                    <div class="flex flex-col gap-2.5 mb-4">
                        <button @click="confirmMode('self')"
                            class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]"
                            :class="selectedMode === 'self' ? 'border-sky-500 bg-sky-50' : 'border-gray-100 bg-gray-50 hover:bg-sky-50/40'">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-500 text-lg">
                                    <i class="fa-solid fa-gamepad"></i>
                                </div>
                                <div class="text-left">
                                    <div class="text-sm font-bold text-gray-700 leading-tight">自己玩</div>
                                    <div class="text-[10px] text-gray-400">你来操控爪子</div>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-gray-300"></i>
                        </button>
                        <button @click="confirmMode('ai')"
                            class="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all active:scale-[0.98]"
                            :class="selectedMode === 'ai' ? 'border-sky-500 bg-sky-50' : 'border-gray-100 bg-gray-50 hover:bg-sky-50/40'">
                            <div class="flex items-center gap-3">
                                <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-9 h-9 rounded-full object-cover bg-sky-100" @error="onAvatarError" />
                                <div class="text-left">
                                    <div class="text-sm font-bold text-gray-700 leading-tight">让TA玩</div>
                                    <div class="text-[10px] text-gray-400">{{ getCharDisplayName(clawStore.invitedCharId) || 'TA' }}来抓</div>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-gray-300"></i>
                        </button>
                    </div>
                    <button @click="cancelModeSelector"
                        class="w-full py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold active:scale-95 transition-all">
                        取消（退币）
                    </button>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 充值弹窗（不再是一个独立阶段） -->
        <!-- ============================================================ -->
        <div v-if="showRecharge" class="fixed inset-0 bg-black/50 z-[60] flex items-end" @click.self="showRecharge = false">
            <div class="w-full h-[82%] bg-[#f0f9ff] rounded-t-3xl flex flex-col overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                    <h2 class="text-lg font-bold text-gray-800">充值游戏币</h2>
                    <button @click="showRecharge = false" class="w-8 h-8 flex items-center justify-center text-gray-400">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-4">
                    <div class="bg-gradient-to-r from-sky-500 to-cyan-600 rounded-2xl p-4 mb-4 text-white">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="text-xs opacity-80">游戏币余额</div>
                                <div class="text-3xl font-bold flex items-center gap-1">
                                    <i class="fa-solid fa-coins text-lg"></i>
                                    <span>{{ clawStore.coins }}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs opacity-80">钱包余额</div>
                                <div class="text-lg font-bold">¥ {{ walletBalance }}</div>
                            </div>
                        </div>
                    </div>

                    <h3 class="font-bold text-gray-700 mb-2">充值包</h3>
                    <div class="grid grid-cols-2 gap-3 mb-4">
                        <div v-for="pkg in clawStore.rechargePackages" :key="pkg.id" @click="handleRecharge(pkg)"
                            class="bg-white rounded-2xl p-3 shadow text-center active:scale-95 transition-transform cursor-pointer relative">
                            <div v-if="pkg.bonus > 0"
                                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                +{{ pkg.bonus }}
                            </div>
                            <div class="text-2xl font-bold text-sky-600">{{ pkg.coins + pkg.bonus }}</div>
                            <div class="text-xs text-gray-400 mb-1">{{ pkg.label }}</div>
                            <div class="text-sm font-bold text-orange-500">¥{{ pkg.price }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段6: 结果展示 -->
        <!-- ============================================================ -->
        <div v-if="clawStore.gamePhase === 'result'" class="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pt-[50px] bg-black/35 backdrop-blur-md">
            <!-- 发光展台 -->
            <div class="relative w-[280px] flex flex-col items-center">
                <!-- 顶部标题 -->
                <div class="text-center mb-4">
                    <div v-if="clawStore.lastGrabResult?.success" class="relative inline-block">
                        <div class="absolute inset-0 blur-lg bg-sky-400/50 rounded-full"></div>
                        <h2 class="relative text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-400 to-sky-500 drop-shadow-sm">
                            ✨ 抓到了
                        </h2>
                    </div>
                    <h2 v-else class="text-3xl font-black text-gray-300">没抓到…</h2>
                    <p class="text-xs text-white/70 mt-1 drop-shadow">来自 {{ clawStore.currentMachine?.name }}</p>
                </div>

                <!-- 展台 + 玩偶 -->
                <div class="relative w-48 h-48 mb-4">
                    <!-- 动态展台：旋转光环 + 呼吸柔光 -->
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="booth-halo"></div>
                    </div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="booth-glow"></div>
                    </div>
                    <!-- 干净接触阴影（贴合玩偶底部，不再悬浮穿帮） -->
                    <div class="absolute bottom-5 left-1/2 -translate-x-1/2 w-28 h-5 rounded-[100%] bg-black/20 blur-md"></div>
                    <!-- 玩偶 -->
                    <div v-if="clawStore.lastGrabResult?.success" class="absolute inset-0 flex items-center justify-center pb-10">
                        <img :src="clawStore.lastGrabResult.doll.image"
                            class="w-36 h-36 object-contain"
                            style="filter: drop-shadow(0 10px 16px rgba(14,165,233,0.4));" />
                    </div>
                    <div v-else class="absolute inset-0 flex items-center justify-center pb-8">
                        <div class="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
                            <i class="fa-regular fa-face-frown text-6xl text-white/40"></i>
                        </div>
                    </div>
                    <!-- 星星特效 -->
                    <div v-if="clawStore.lastGrabResult?.success" class="absolute inset-0 pointer-events-none">
                        <i class="fa-solid fa-star absolute top-4 left-6 text-yellow-300 text-sm animate-pulse"></i>
                        <i class="fa-solid fa-star absolute top-10 right-8 text-sky-300 text-xs animate-pulse" style="animation-delay: 0.2s"></i>
                        <i class="fa-solid fa-star absolute bottom-16 left-4 text-cyan-300 text-xs animate-pulse" style="animation-delay: 0.4s"></i>
                        <i class="fa-solid fa-star absolute bottom-20 right-4 text-yellow-200 text-sm animate-pulse" style="animation-delay: 0.6s"></i>
                    </div>
                </div>

                <!-- 玩偶名称 -->
                <div v-if="clawStore.lastGrabResult?.success" class="text-center mb-4">
                    <p class="text-xl font-black text-white drop-shadow-md">{{ clawStore.lastGrabResult.doll.name }}</p>
                    <p class="text-[10px] text-sky-200 mt-0.5">已收入展馆</p>
                </div>

                <!-- AI 聊天反应（仅显示最新一条） -->
                <div v-if="lastAiReaction" class="max-w-[260px] mb-5 bg-white/85 backdrop-blur rounded-2xl px-3 py-2 shadow-lg">
                    <div class="flex items-start gap-2">
                        <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-6 h-6 rounded-full object-cover bg-sky-100 shrink-0" @error="onAvatarError" />
                        <div class="text-xs text-gray-700 leading-relaxed">{{ lastAiReaction }}</div>
                    </div>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="w-full max-w-[320px] mt-2 space-y-2.5">
                <button @click="nextRound"
                    class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold shadow-lg shadow-sky-500/25 active:scale-95 transition-transform">
                    再来一局
                </button>
                <button @click="exitToSelecting" class="w-full py-3 rounded-2xl bg-white/20 text-white font-bold text-sm shadow active:scale-95 transition-transform">
                    返回选机子
                </button>
                <!-- 新增：结算后可直接返回游戏大厅 -->
                <button @click="returnToHall" class="w-full py-2.5 rounded-2xl bg-transparent text-white/80 font-medium text-sm border border-white/30 active:scale-95 transition-transform">
                    返回大厅
                </button>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 展馆弹窗 -->
        <!-- ============================================================ -->
        <div v-if="showExhibition" class="fixed inset-0 bg-black/50 z-50 flex items-end" @click.self="showExhibition = false">
            <div class="w-full h-[86%] bg-[#f0f9ff] rounded-t-3xl flex flex-col overflow-hidden">
                <div class="flex items-center justify-between p-4 bg-white/80 backdrop-blur border-b border-sky-100">
                    <h2 class="text-lg font-black text-sky-600 flex items-center gap-1.5">
                        <i class="fa-solid fa-trophy"></i> 我的展馆
                    </h2>
                    <div class="flex items-center gap-2">
                        <button @click="warehouseMode = !warehouseMode"
                            class="px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                            :class="warehouseMode ? 'bg-sky-500 text-white shadow' : 'bg-sky-100 text-sky-600'">
                            <i class="fa-solid fa-box-open mr-1"></i>{{ warehouseMode ? '退出仓库' : '仓库' }}
                        </button>
                        <button @click="showExhibition = false" class="w-8 h-8 flex items-center justify-center text-gray-400">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- 展馆场景（可换背景） -->
                <div class="flex-1 overflow-y-auto relative" ref="exhibitionArea">
                    <div class="absolute inset-0 bg-cover bg-center"
                        :style="{ backgroundImage: `url(${clawStore.currentExhibitionBg})` }">
                        <div class="absolute inset-0 bg-gradient-to-b from-white/10 to-white/30"></div>
                    </div>

                    <div v-if="clawStore.exhibition.length === 0" class="relative z-10 text-center text-gray-500 py-20">
                        <i class="fa-solid fa-trophy text-5xl mb-3 text-sky-200"></i>
                        <p>展馆空空如也</p>
                        <p class="text-xs mt-1">去抓几个娃娃回来吧～</p>
                    </div>

                    <div v-for="item in clawStore.exhibition" :key="item.id"
                        class="absolute z-10 group"
                        :style="{ left: item.position.x + '%', top: item.position.y + '%' }">
                        <div class="relative">
                            <img :src="item.dollImage" class="w-20 h-20 object-contain drop-shadow-xl" />
                            <div class="absolute -top-1 -right-1 transition-opacity"
                                :class="warehouseMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'">
                                <button @click.stop="clawStore.removeFromExhibition(item.id)"
                                    class="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center shadow">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div class="text-[10px] text-center text-gray-600 mt-0.5 max-w-[80px] truncate font-medium bg-white/60 rounded-full px-1">{{ item.dollName }}</div>
                        </div>
                    </div>

                    <!-- 仓库模式：库存托盘（点按摆到书桌） -->
                    <div v-if="warehouseMode" class="absolute bottom-2 left-2 right-2 z-20">
                        <div class="bg-white/85 backdrop-blur rounded-2xl p-2 shadow-lg border border-sky-100">
                            <div class="text-[10px] font-bold text-sky-600 mb-1.5 px-1">仓库库存（点按摆到书桌 · ×移回仓库）</div>
                            <div v-if="clawStore.availableWarehouse.length === 0" class="text-[10px] text-gray-400 px-1 py-1">
                                书桌上已摆放全部库存啦～
                            </div>
                            <div v-else class="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                                <button v-for="wh in clawStore.availableWarehouse" :key="wh.id"
                                    @click="clawStore.placeFromWarehouse(wh)"
                                    class="relative shrink-0 w-14 h-14 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center active:scale-95 transition-transform">
                                    <img :src="wh.dollImage" class="w-12 h-12 object-contain" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 背景切换栏 -->
                <div class="p-3 bg-white/90 backdrop-blur border-t border-sky-100">
                    <div class="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                        <button v-for="bg in clawStore.EXHIBITION_BACKGROUNDS" :key="bg.id"
                            @click="clawStore.setExhibitionBg(bg.id)"
                            class="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all"
                            :class="clawStore.exhibitionBgId === bg.id ? 'border-sky-500 shadow-md' : 'border-gray-200'">
                            <img :src="bg.image" class="w-full h-full object-cover" />
                            <span class="absolute bottom-0 inset-x-0 text-[9px] text-center text-white bg-black/30 py-0.5">{{ bg.name }}</span>
                        </button>
                        <button v-if="clawStore.exhibitionCustomBg"
                            @click="clawStore.setExhibitionBg('custom')"
                            class="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all"
                            :class="clawStore.exhibitionBgId === 'custom' ? 'border-sky-500 shadow-md' : 'border-gray-200'">
                            <img :src="clawStore.exhibitionCustomBg" class="w-full h-full object-cover" />
                            <span class="absolute bottom-0 inset-x-0 text-[9px] text-center text-white bg-black/30 py-0.5">自定义</span>
                        </button>
                        <label class="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-sky-300 flex flex-col items-center justify-center text-sky-400 cursor-pointer active:scale-95 transition-transform">
                            <i class="fa-solid fa-plus text-lg"></i>
                            <span class="text-[9px] mt-0.5">上传</span>
                            <input type="file" accept="image/*" class="hidden" @change="handleExhibitionBgUpload" />
                        </label>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-xs text-gray-400">点击“仓库”后，从下方库存点按摆放</span>
                        <button v-if="clawStore.exhibition.length > 0" @click="confirmClearExhibition"
                            class="text-xs text-rose-400 font-medium">清空展馆</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 自定义玩偶上传弹窗 -->
        <!-- ============================================================ -->
        <div v-if="customUploadMachineId" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
            @click.self="customUploadMachineId = null">
            <div class="bg-white rounded-3xl p-6 w-full max-w-sm">
                <h3 class="text-lg font-bold text-gray-800 mb-2">上传自定义玩偶</h3>
                <p class="text-sm text-gray-400 mb-4">上传一张白底图片，系统会自动抠像作为玩偶贴图</p>

                <div v-if="customPreview" class="w-32 h-32 mx-auto mb-4 bg-gray-50 rounded-2xl flex items-center justify-center p-2">
                    <img :src="customPreview" class="w-full h-full object-contain" />
                </div>

                <div v-if="clawStore.getCustomDoll(customUploadMachineId)" class="mb-3 p-2 bg-green-50 rounded-xl text-xs text-green-600 text-center">
                    <i class="fa-solid fa-check-circle"></i> 已设置自定义玩偶
                </div>

                <label
                    class="block w-full py-3 rounded-2xl bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-center font-bold text-sm cursor-pointer active:scale-95 transition-transform">
                    选择图片
                    <input type="file" accept="image/*" class="hidden" @change="handleCustomUpload" />
                </label>

                <div v-if="customUploading" class="text-center text-sm text-gray-400 mt-3">
                    <i class="fa-solid fa-spinner fa-spin mr-1"></i> 正在抠像处理...
                </div>

                <button @click="customUploadMachineId = null; customPreview = null"
                    class="w-full mt-3 py-2 text-sm text-gray-400">关闭</button>
            </div>
        </div>

        <!-- Toast -->
        <div v-if="toastMessage" class="fixed top-14 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full text-sm shadow-lg"
            :class="toastType === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'">
            {{ toastMessage }}
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useClawMachineStore } from '../../stores/clawMachineStore.js'
import { useChatStore } from '../../stores/chatStore.js'
import { useWalletStore } from '../../stores/walletStore.js'
import { useSettingsStore } from '../../stores/settingsStore.js'
import { compressImage } from '../../utils/imageUtils.js'
import { findNearestDoll } from '../../utils/clawMachine/ClawMachineEngine.js'
import {
    playSound,
    startBGM,
    stopBGM,
    setBgmVolume,
    unlockAudio,
} from '../../utils/clawMachine/ClawMachineSounds.js'

const router = useRouter()
const clawStore = useClawMachineStore()
const chatStore = useChatStore()
const walletStore = useWalletStore()
const settingsStore = useSettingsStore()

// ============================================================
// 本地状态
// ============================================================
const showExhibition = ref(false)
const warehouseMode = ref(false)
const showRecharge = ref(false)
const customUploadMachineId = ref(null)
const customPreview = ref(null)
const customUploading = ref(false)
const chatInput = ref('')
const streamingText = ref('')
const toastMessage = ref('')
const toastType = ref('info')
const exhibitionArea = ref(null)
const chatContainer = ref(null)
const chatOpen = ref(false)
const selectedMode = ref('self') // 'self' | 'ai'
const showModeSelector = ref(false) // 投币后显示中央模式选择
const unreadCount = ref(0)
const seenCount = ref(0) // 已查看的游戏内消息条数，用于准确计算未读

// 摇杆
const joystickBase = ref(null)
const joystickDragging = ref(false)
const joystickDelta = ref({ x: 0, y: 0 })
let lastMoveSoundTime = 0

// 倒计时
const COUNTDOWN_TOTAL = 25
const timeLeft = ref(COUNTDOWN_TOTAL)
const countdownPct = computed(() => Math.max(0, (timeLeft.value / COUNTDOWN_TOTAL) * 100))
const countdownGradient = computed(() => {
    const pct = countdownPct.value
    // 从天蓝色逐渐过渡到橙红色
    if (pct > 60) return 'linear-gradient(to top, #38bdf8, #7dd3fc)'
    if (pct > 30) return 'linear-gradient(to top, #fbbf24, #38bdf8)'
    return 'linear-gradient(to top, #f43f5e, #fbbf24)'
})
const countdownGlowColor = computed(() => {
    const pct = countdownPct.value
    if (pct > 60) return 'rgba(56,189,248,0.7)'
    if (pct > 30) return 'rgba(251,191,36,0.7)'
    return 'rgba(244,63,94,0.7)'
})
let countdownTimer = null

// 气泡
const activeBubbles = ref([])
let bubbleTimer = null

// 涟漪
const ripples = ref([])

// ============================================================
// 文案池
// ============================================================
const cheerPhrases = [
    '加油！', '稳住！', '就是现在！', '冲鸭！', '相信你的手气！',
    '抓它！', '准一点！', '好机会！', '别紧张~', '瞄准啦！'
]
const successPhrases = [
    '抓到了！', '太棒了！', '好耶！', '命中！', '厉害！'
]
const failPhrases = [
    '差一点点…', '下次一定！', '再来一次！', '好可惜~', '差一点！'
]
const sabotageUserPhrases = [
    '捣乱！', '我戳~', '别想抓到！', '手滑了~', '干扰一下！'
]
const sabotageReplyPhrases = [
    '哎呀，别捣乱~', '哼哼，阻止不了我', '看我的！', '你坏~', '小心我反杀！'
]

// ============================================================
// 计算属性
// ============================================================

const walletBalance = computed(() => (walletStore.balance || 0).toFixed(2))

const clawHookOffset = computed(() => {
    return clawStore.currentMachine?.layout?.clawHookOffset || 13
})

const userProfile = computed(() => {
    return settingsStore.personalization?.userProfile || {}
})

const defaultAvatar = computed(() => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userProfile.value.name || 'Me')}`
})

const contactList = computed(() => {
    return (chatStore.contactList || []).filter(c => !c.isGroup).map(c => ({
        ...c,
        displayName: c.remark?.trim() ? c.remark.trim() : c.name,
    }))
})

/** 当前被抓中的玩偶 */
const caughtDoll = computed(() => {
    if (!clawStore.lastGrabResult?.success || !clawStore.lastGrabResult.doll) return null
    return clawStore.lastGrabResult.doll
})

/** 爪子是否正在动画中 */
const isClawAnimating = computed(() => {
    return ['moving', 'dropping', 'grabbing', 'rising'].includes(clawStore.clawState)
})

/** 当前是否轮到自己操控且可交互 */
const isUserPlaying = computed(() => {
    return clawStore.controller === 'user' && clawStore.playMode && clawStore.gamePhase === 'playing'
})

/** 当前对准的目标玩偶 */
const targetDoll = computed(() => {
    if (clawStore.controller !== 'user' || clawStore.clawState !== 'idle') return null
    if (!clawStore.machineLayout.length) return null
    const nearest = findNearestDoll(clawStore.machineLayout, clawStore.clawX, 42)
    return nearest && nearest.distance <= 16 ? nearest.doll : null
})

const visibleChatMessages = computed(() => {
    return clawStore.gameChatMessages.slice(-8)
})

const controllerText = computed(() => {
    if (clawStore.controller === 'ai') return `${getCharDisplayName(clawStore.invitedCharId)} 操控中`
    if (!clawStore.playMode) return '等待投币'
    return '你操控中'
})

const joystickStyle = computed(() => {
    const maxR = 22 // 摇杆最大移动半径 px
    const dx = joystickDelta.value.x
    const dy = joystickDelta.value.y
    return {
        transform: `translate(${dx}px, ${dy}px)`,
    }
})

const lastAiReaction = computed(() => {
    const msgs = clawStore.gameChatMessages
    for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'ai') return msgs[i].content
    }
    return ''
})

// ============================================================
// 工具函数
// ============================================================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function showToast(message, type = 'info') {
    toastMessage.value = message
    toastType.value = type
    setTimeout(() => { toastMessage.value = '' }, 2500)
}

function getCharAvatar(charId) {
    if (!charId) return ''
    const char = chatStore.chats[charId]
    return char?.avatar || ''
}

function getCharDisplayName(charId) {
    if (!charId) return ''
    const char = chatStore.chats[charId]
    if (!char) return ''
    return char.remark?.trim() ? char.remark.trim() : char.name
}

function onAvatarError(e) {
    e.target.style.display = 'none'
}

function getClawStateText() {
    const state = clawStore.clawState
    const texts = {
        moving: '移动中…',
        dropping: '下勾中…',
        grabbing: '抓取中…',
        rising: '上升中…',
        result: '出结果了！',
    }
    return texts[state] || ''
}

// ============================================================
// 倒计时
// ============================================================

function startCountdown() {
    stopCountdown()
    timeLeft.value = COUNTDOWN_TOTAL
    countdownTimer = setInterval(() => {
        if (!isUserPlaying.value || clawStore.clawState !== 'idle') {
            stopCountdown()
            return
        }
        timeLeft.value -= 0.1
        if (timeLeft.value <= 0) {
            timeLeft.value = 0
            stopCountdown()
            handleDrop()
        }
    }, 100)
}

function stopCountdown() {
    if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
    }
}

watch([() => clawStore.controller, () => clawStore.clawState, () => clawStore.gamePhase, () => clawStore.playMode], () => {
    if (isUserPlaying.value && clawStore.clawState === 'idle') {
        startCountdown()
    } else {
        stopCountdown()
    }
})

// ============================================================
// 摇杆拖拽
// ============================================================

function onJoystickStart(e) {
    if (!isUserPlaying.value || clawStore.clawState !== 'idle') return
    joystickDragging.value = true
    joystickBase.value?.setPointerCapture?.(e.pointerId)
    updateJoystick(e)
}

function onJoystickMove(e) {
    if (!joystickDragging.value) return
    e.preventDefault()
    updateJoystick(e)
}

function onJoystickEnd(e) {
    if (!joystickDragging.value) return
    joystickDragging.value = false
    joystickDelta.value = { x: 0, y: 0 }
    joystickBase.value?.releasePointerCapture?.(e.pointerId)
}

function updateJoystick(e) {
    const rect = joystickBase.value.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const maxR = rect.width / 2 - 22 // 外圈半径 - 摇杆半径

    let dx = e.clientX - centerX
    let dy = e.clientY - centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxR) {
        dx = (dx / dist) * maxR
        dy = (dy / dist) * maxR
    }
    joystickDelta.value = { x: dx, y: dy }

    // 水平映射到爪子位置（22-78）
    const ratio = dx / maxR
    const range = 56 // 78 - 22
    const newX = 50 + ratio * (range / 2)
    clawStore.setClawPosition(Math.max(22, Math.min(78, newX)))

    // 摇杆移动音效：节流，避免连续触发
    const now = Date.now()
    if (now - lastMoveSoundTime > 120) {
        lastMoveSoundTime = now
        playSound('move', { volume: 0.6 })
    }
}

// ============================================================
// 气泡与特效
// ============================================================

function spawnBubble(text, x, y, duration = 1800) {
    const id = `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    activeBubbles.value.push({ id, text, x, y })
    setTimeout(() => {
        activeBubbles.value = activeBubbles.value.filter(b => b.id !== id)
    }, duration)
}

function getSafeBubblePosition() {
    // 屏幕中上部，避开顶部信息区和爪子附近
    let x, y, safe
    let attempts = 0
    do {
        x = 25 + Math.random() * 50
        y = 22 + Math.random() * 20
        safe = activeBubbles.value.every(b => {
            const dx = b.x - x
            const dy = b.y - y
            return Math.sqrt(dx * dx + dy * dy) > 12
        })
        attempts++
    } while (!safe && attempts < 20)
    return { x, y }
}

function startCheerBubbles() {
    clearInterval(bubbleTimer)
    bubbleTimer = setInterval(() => {
        if (clawStore.gamePhase !== 'playing') return
        const text = cheerPhrases[Math.floor(Math.random() * cheerPhrases.length)]
        const { x, y } = getSafeBubblePosition()
        spawnBubble(text, x, y, 2000)
    }, 3000)
}

function stopCheerBubbles() {
    clearInterval(bubbleTimer)
    bubbleTimer = null
}

function spawnRipple(x, y) {
    const id = `ripple-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    ripples.value.push({ id, x, y })
    setTimeout(() => {
        ripples.value = ripples.value.filter(r => r.id !== id)
    }, 700)
}

function onSabotage(e) {
    if (clawStore.controller !== 'ai' || clawStore.clawState === 'idle') return
    if (!clawStore.invitedCharId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    spawnRipple(x, y)

    const userText = sabotageUserPhrases[Math.floor(Math.random() * sabotageUserPhrases.length)]
    clawStore.addGameChatMessage('user', userText)

    const replyText = sabotageReplyPhrases[Math.floor(Math.random() * sabotageReplyPhrases.length)]
    const { x: bx, y: by } = getSafeBubblePosition()
    spawnBubble(replyText, bx, by, 2200)

    if (clawStore.clawState === 'moving') {
        const jitter = (Math.random() - 0.5) * 5
        clawStore.setClawPosition(Math.max(22, Math.min(78, clawStore.clawX + jitter)))
    }
}

// ============================================================
// 阶段1: 邀请角色
// ============================================================

function selectChar(char) {
    clawStore.setInvitedChar(char.id, char.displayName)
}

function goToSelecting() {
    clawStore.gamePhase = 'selecting'
}

// ============================================================
// 阶段2: 选机子
// ============================================================

function enterMachine(machineId) {
    clawStore.selectMachine(machineId)
    selectedMode.value = 'self'
    // 载入的是本会话历史消息，不应计为未读
    seenCount.value = clawStore.gameChatMessages.length
    unreadCount.value = 0
    // 每个娃娃机进入时重新随机一首 BGM，实现"6 个机子单独循环"
    stopBGM()
    startBGM()
}

function openCustomUpload(machineId) {
    customUploadMachineId.value = machineId
    customPreview.value = clawStore.getCustomDoll(machineId) || null
}

async function handleCustomUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    customUploading.value = true
    try {
        const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 })
        customPreview.value = compressed

        const result = await clawStore.uploadCustomDoll(customUploadMachineId.value, file)
        if (result.success) {
            customPreview.value = clawStore.getCustomDoll(customUploadMachineId.value)
            showToast(result.message)
        } else {
            showToast(result.message, 'error')
        }
    } catch (e) {
        showToast('上传失败：' + e.message, 'error')
    } finally {
        customUploading.value = false
    }
}

async function handleExhibitionBgUpload(event) {
    const file = event.target.files[0]
    if (!file) return
    const result = await clawStore.uploadExhibitionBg(file)
    showToast(result.message, result.success ? 'info' : 'error')
}

// ============================================================
// 充值
// ============================================================

function openRecharge() {
    showRecharge.value = true
}

function handleRecharge(pkg) {
    const result = clawStore.rechargeCoins(pkg)
    showToast(result.message, result.success ? 'info' : 'error')
}

// ============================================================
// 投币与开始
// ============================================================

async function insertCoinAndStart() {
    if (!clawStore.canPlay) {
        showToast('游戏币不足，点击右上角余额充值', 'error')
        openRecharge()
        return
    }

    // 先扣币，再弹出中央模式选择器
    const success = clawStore.insertCoin()
    if (!success) {
        showToast('游戏币不足！', 'error')
        openRecharge()
        return
    }

    playSound('coin')
    showModeSelector.value = true
}

async function confirmMode(mode) {
    showModeSelector.value = false
    selectedMode.value = mode
    playSound('switch')

    const success = clawStore.startGame(mode, { alreadyInserted: true })
    if (!success) {
        showToast('开始失败，请重试', 'error')
        return
    }

    // 发送系统通知：正在一起玩抓娃娃
    if (clawStore.invitedCharId) {
        clawStore.sendStartNotificationToChat().catch(() => {})
    }

    startCheerBubbles()

    if (mode === 'ai') {
        await playAITurn()
    }
}

function cancelModeSelector() {
    clawStore.refundCoin()
    showModeSelector.value = false
}

// ============================================================
// 自己玩：爪子控制
// ============================================================

async function handleDrop() {
    if (clawStore.clawState !== 'idle') return

    clawStore.setClawState('dropping')
    playSound('drop')
    await animateClawDrop()

    await delay(180)

    clawStore.dropClaw()

    clawStore.setClawState('grabbing')
    playSound('grab')
    await delay(500)

    clawStore.setClawState('rising')
    await animateClawRise()

    clawStore.setClawState('result')
    clawStore.gamePhase = 'result'
    stopCheerBubbles()

    const phrase = clawStore.lastGrabResult?.success
        ? successPhrases[Math.floor(Math.random() * successPhrases.length)]
        : failPhrases[Math.floor(Math.random() * failPhrases.length)]
    const { x, y } = getSafeBubblePosition()
    spawnBubble(phrase, x, y, 2200)
    playSound(clawStore.lastGrabResult?.success ? 'win' : 'fail')

    // 所有模式、所有结果都自动发结果卡片（自己玩=用户抓，让TA玩=AI抓）
    clawStore.autoShareResultToChat().then((ok) => {
        showToast(ok ? '已发送' : '发送失败', ok ? 'success' : 'error')
    })
    if (clawStore.invitedCharId) {
        await clawStore.fetchAIReaction('user')
    }
}

async function animateClawDrop() {
    const startY = clawStore.clawY
    const machine = clawStore.currentMachine
    const clawParams = machine?.layout || { clawDropY: 58, clawTopY: 5 }
    const targetY = clawParams.clawDropY
    const duration = 900
    const startTime = Date.now()

    return new Promise(resolve => {
        function step() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            const eased = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2
            clawStore.setClawPosition(clawStore.clawX, startY + (targetY - startY) * eased)
            if (progress < 1) {
                requestAnimationFrame(step)
            } else {
                resolve()
            }
        }
        step()
    })
}

async function animateClawRise() {
    const startY = clawStore.clawY
    const machine = clawStore.currentMachine
    const clawParams = machine?.layout || { clawDropY: 58, clawTopY: 5 }
    const targetY = clawParams.clawTopY
    const duration = 900
    const startTime = Date.now()

    return new Promise(resolve => {
        function step() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            const eased = progress * (2 - progress)
            clawStore.setClawPosition(clawStore.clawX, startY + (targetY - startY) * eased)
            if (progress < 1) {
                requestAnimationFrame(step)
            } else {
                resolve()
            }
        }
        step()
    })
}

// ============================================================
// 让TA玩：AI 游玩流程
// ============================================================

async function playAITurn() {
    await clawStore.fetchAIOpening()

    const { steps } = clawStore.performAIPlay({ aiSkill: 0.55 })

    for (const step of steps) {
        if (step.type === 'move') {
            clawStore.setClawState('moving')
            playSound('move')
            await animateClawMove(step.x, step.duration)
        } else if (step.type === 'drop') {
            clawStore.setClawState('dropping')
            playSound('drop')
            await animateClawDrop()
            clawStore.setClawState('grabbing')
            playSound('grab')
            await delay(500)
            clawStore.setClawState('rising')
            await animateClawRise()
        }
    }

    clawStore.setClawState('result')
    clawStore.gamePhase = 'result'
    stopCheerBubbles()

    const phrase = clawStore.lastGrabResult?.success
        ? successPhrases[Math.floor(Math.random() * successPhrases.length)]
        : failPhrases[Math.floor(Math.random() * failPhrases.length)]
    const { x, y } = getSafeBubblePosition()
    spawnBubble(phrase, x, y, 2200)
    playSound(clawStore.lastGrabResult?.success ? 'win' : 'fail')

    // 所有模式、所有结果都自动发结果卡片（让TA玩=AI抓）
    clawStore.autoShareResultToChat().then((ok) => {
        showToast(ok ? '已发送' : '发送失败', ok ? 'success' : 'error')
    })
    await clawStore.fetchAIReaction('ai')
}

async function animateClawMove(targetX, duration) {
    const startX = clawStore.clawX
    const startTime = Date.now()

    return new Promise(resolve => {
        function step() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            const eased = 1 - Math.pow(1 - progress, 3)
            const x = startX + (targetX - startX) * eased
            clawStore.setClawPosition(x)
            if (progress < 1) {
                requestAnimationFrame(step)
            } else {
                resolve()
            }
        }
        step()
    })
}

// ============================================================
// 聊天
// ============================================================

async function sendChat() {
    const msg = chatInput.value.trim()
    if (!msg || clawStore.aiThinking) return

    chatInput.value = ''
    streamingText.value = ''

    await clawStore.sendGameChat(msg, (chunk) => {
        streamingText.value += chunk
    })

    streamingText.value = ''
}

watch(() => clawStore.gameChatMessages.length, async (len) => {
    await nextTick()
    if (!chatOpen.value) {
        // 未读数 = 当前总数 - 已查看数（始终与实际消息对齐，避免"显示3却无消息"）
        unreadCount.value = Math.max(0, len - seenCount.value)
    } else {
        seenCount.value = len
    }
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
})

watch(chatOpen, (v) => {
    if (v) {
        seenCount.value = clawStore.gameChatMessages.length
        unreadCount.value = 0
    }
})

// 关闭展馆时退出仓库模式（画面固定，禁止误拖）
watch(showExhibition, (v) => {
    if (!v) warehouseMode.value = false
})

// ============================================================
// 下一轮
// ============================================================

function nextRound() {
    clawStore.replay()
    selectedMode.value = 'self'
    seenCount.value = clawStore.gameChatMessages.length
    unreadCount.value = 0
}

function exitToSelecting() {
    clawStore.cancelAI()
    clawStore.resetSession()
    clawStore.gamePhase = 'selecting'
}

// 结算后返回游戏大厅（/games）
function returnToHall() {
    // 先关闭可能残留的弹层，避免事件被吞或状态残留
    showExhibition.value = false
    showRecharge.value = false
    customUploadMachineId.value = null
    showModeSelector.value = false
    clawStore.cancelAI()
    clawStore.resetSession()
    // 跳转前先收起结果态；重复点击/同路由会被 Vue Router 拒绝为 NavigationDuplicated，需吞掉
    router.push('/games').catch(() => {})
}

// ============================================================
// 展馆操作
// ============================================================

function confirmClearExhibition() {
    if (confirm('确定要清空展馆吗？所有抓到的娃娃都会消失哦！')) {
        clawStore.clearExhibition()
        showToast('展馆已清空')
    }
}

// ============================================================
// 导航
// ============================================================

function handleBack() {
    stopCountdown()
    stopCheerBubbles()
    // 优先关闭弹层
    if (showModeSelector.value) {
        cancelModeSelector()
        return
    }
    if (chatOpen.value) {
        chatOpen.value = false
        return
    }
    if (showExhibition.value) {
        showExhibition.value = false
        return
    }
    // 游戏中/结果 -> 返回选机子界面（结束本局）
    if (clawStore.gamePhase === 'playing' || clawStore.gamePhase === 'result') {
        const isActive = clawStore.gamePhase === 'playing' && clawStore.playMode
        if (!isActive || confirm('游戏进行中，确定要结束本局并返回选机子吗？')) {
            clawStore.cancelAI()
            clawStore.resetSession()
            clawStore.gamePhase = 'selecting'
        }
        return
    }
    // 选机子 -> 返回邀请界面
    if (clawStore.gamePhase === 'selecting') {
        clawStore.gamePhase = 'idle'
        return
    }
    // 邀请/空闲 -> 返回游戏大厅
    router.push('/games')
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
    if (clawStore.gamePhase === 'idle' && !clawStore.invitedCharId) {
        clawStore.gamePhase = 'idle'
    }
    seenCount.value = clawStore.gameChatMessages.length
    unreadCount.value = 0
    // 进入娃娃机页面即开始 BGM（两首随机循环）
    startBGM()
})

onUnmounted(() => {
    clawStore.cancelAI()
    stopCountdown()
    stopCheerBubbles()
    stopBGM()
})
</script>

<style scoped>
/* 机台裁顶放大：隐藏静态钩子，同时填满屏幕 */
.machine-frame {
    background: linear-gradient(180deg, #e0f2fe 0%, #f0f9ff 100%);
}

/* 玻璃质感控件 */
.chat-panel {
    width: 220px;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.55);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
    overflow: hidden;
}

.chat-toggle {
    width: 48px;
    height: 48px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #db2777;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
    position: relative;
}

.joystick-base {
    background: rgba(255, 255, 255, 0.42);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.5);
    touch-action: none;
}

.joystick-hollow {
    background: rgba(0, 0, 0, 0.06);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.12);
}

.joystick-stick {
    background: linear-gradient(180deg, #f9a8d4 0%, #f472b6 100%);
    touch-action: none;
}

.coin-btn {
    width: 84px;
    height: 84px;
    border-radius: 9999px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
    box-shadow: 0 10px 28px rgba(245, 158, 11, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.35);
    border: 3px solid rgba(255, 255, 255, 0.45);
    transition: transform 0.1s ease;
}

.coin-btn:active {
    transform: scale(0.92);
}

.grab-btn {
    width: 84px;
    height: 84px;
    border-radius: 9999px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    background: linear-gradient(180deg, #fb7185 0%, #e11d48 100%);
    box-shadow: 0 10px 28px rgba(225, 29, 72, 0.35), inset 0 2px 2px rgba(255, 255, 255, 0.35);
    border: 3px solid rgba(255, 255, 255, 0.45);
    transition: transform 0.1s ease;
}

.grab-btn:active {
    transform: scale(0.92);
}

.hint-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    color: #be185d;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.5);
}

/* 气泡弹出动画 */
.pop-enter-active {
    animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.pop-leave-active {
    animation: popOut 0.3s ease-in forwards;
}

@keyframes popIn {
    0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.4) translateY(12px);
    }
    100% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1) translateY(0);
    }
}

@keyframes popOut {
    0% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8) translateY(-10px);
    }
}

/* 点击涟漪 */
.ripple-ring {
    width: 40px;
    height: 40px;
    margin-left: -20px;
    margin-top: -20px;
    opacity: 0.8;
}

.ripple-enter-active {
    animation: rippleExpand 0.6s ease-out forwards;
}

.ripple-leave-active {
    animation: rippleFade 0.1s ease-out forwards;
}

@keyframes rippleExpand {
    0% {
        transform: scale(0.2);
        opacity: 0.9;
    }
    100% {
        transform: scale(2.8);
        opacity: 0;
    }
}

@keyframes rippleFade {
    to {
        opacity: 0;
    }
}

/* 爪子抓紧动画 */
@keyframes claw-grip {
    0% { transform: translate(-50%, 0) scale(1); }
    30% { transform: translate(-50%, 0) scale(0.92); }
    50% { transform: translate(-50%, 0) scale(0.95); }
    70% { transform: translate(-50%, 0) scale(0.92); }
    100% { transform: translate(-50%, 0) scale(0.95); }
}

.claw-grip {
    animation: claw-grip 0.4s ease-in-out forwards;
}

/* 爪子张开动画 */
@keyframes claw-open {
    0% { transform: translate(-50%, 0) scale(1) rotate(0deg); }
    100% { transform: translate(-50%, 0) scale(1.1) rotate(-3deg); }
}

.claw-open {
    animation: claw-open 0.3s ease-out forwards;
}

/* 聊天面板滑入 */
.slide-right-enter-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-right-leave-active {
    transition: all 0.2s ease-in;
}
.slide-right-enter-from,
.slide-right-leave-to {
    opacity: 0;
    transform: translate(20px, -50%) scale(0.96);
}
.slide-right-enter-to,
.slide-right-leave-from {
    opacity: 1;
    transform: translate(0, -50%) scale(1);
}

/* 动态展台特效：旋转光环 + 呼吸柔光（替代静态悬浮底座） */
.booth-halo {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: conic-gradient(
        from 0deg,
        transparent 0%,
        rgba(56, 189, 248, 0.45) 18%,
        transparent 38%,
        rgba(34, 211, 238, 0.4) 58%,
        transparent 78%,
        rgba(125, 211, 252, 0.35) 92%,
        transparent 100%
    );
    filter: blur(3px);
    animation: booth-spin 6s linear infinite;
}
.booth-glow {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(186, 230, 253, 0.6) 0%, rgba(186, 230, 253, 0) 70%);
    animation: booth-pulse 2.6s ease-in-out infinite;
}
@keyframes booth-spin {
    to {
        transform: rotate(360deg);
    }
}
@keyframes booth-pulse {
    0%,
    100% {
        transform: scale(0.82);
        opacity: 0.55;
    }
    50% {
        transform: scale(1.12);
        opacity: 1;
    }
}
</style>