<template>
    <div class="claw-machine-page w-full h-full flex flex-col bg-gradient-to-b from-purple-50 to-pink-50 overflow-hidden">
        <!-- ============================================================ -->
        <!-- 顶部导航栏 -->
        <!-- ============================================================ -->
        <div
            class="h-[50px] bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-between px-4 shadow-lg shrink-0 z-20">
            <button @click="handleBack" class="w-10 h-10 flex items-center justify-center text-white">
                <i class="fa-solid fa-chevron-left text-xl"></i>
            </button>
            <h1 class="text-lg font-bold text-white flex items-center gap-2">
                <i class="fa-solid fa-gamepad"></i>
                <span>娃娃机</span>
            </h1>
            <div class="flex items-center gap-3">
                <button @click="showExhibition = true"
                    class="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-white text-xs">
                    <i class="fa-solid fa-trophy"></i>
                    <span>{{ clawStore.exhibitionCount }}</span>
                </button>
                <div class="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-white text-xs">
                    <i class="fa-solid fa-coins"></i>
                    <span>{{ clawStore.coins }}</span>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段1: 邀请角色 -->
        <!-- ============================================================ -->
        <div v-if="clawStore.gamePhase === 'idle' || clawStore.gamePhase === 'inviting'"
            class="flex-1 overflow-y-auto px-4 py-4">
            <div class="text-center mb-6">
                <img src="/claw-machine-assets/machines/plush.png" class="w-48 h-auto mx-auto mb-3 drop-shadow-xl" />
                <h2 class="text-2xl font-bold text-purple-700 mb-2">邀请好友一起玩</h2>
                <p class="text-sm text-gray-500">从通讯录选择一个角色，共同抓娃娃</p>
            </div>

            <!-- 已选角色 -->
            <div v-if="clawStore.invitedCharId" class="mb-4 p-4 bg-white rounded-2xl shadow flex items-center gap-3">
                <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-14 h-14 rounded-full object-cover bg-gray-100"
                    @error="onAvatarError" />
                <div class="flex-1">
                    <div class="font-bold text-gray-800">{{ clawStore.invitedCharName }}</div>
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
                        <div class="font-bold text-gray-800">{{ char.name }}</div>
                        <div class="text-xs text-gray-400 truncate">{{ (char.prompt || '').slice(0, 40) }}...</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300"></i>
                </div>
            </div>

            <!-- 下一步按钮 -->
            <button v-if="clawStore.invitedCharId" @click="goToSelecting"
                class="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold shadow-lg active:scale-95 transition-transform">
                选择娃娃机 <i class="fa-solid fa-arrow-right ml-1"></i>
            </button>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段2: 选机子 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'selecting'" class="flex-1 overflow-y-auto px-4 py-4">
            <div class="flex items-center gap-2 mb-4">
                <img :src="getCharAvatar(clawStore.invitedCharId)" class="w-8 h-8 rounded-full bg-gray-100"
                    @error="onAvatarError" />
                <span class="text-sm text-gray-500">和 {{ clawStore.invitedCharName }} 一起玩</span>
            </div>

            <h2 class="text-lg font-bold text-purple-700 mb-3">选择娃娃机</h2>

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
        <!-- 阶段3: 充值投币 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'charging'" class="flex-1 overflow-y-auto px-4 py-4">
            <div class="text-center mb-6">
                <img :src="clawStore.currentMachine?.image" class="w-32 h-40 object-cover object-top mx-auto rounded-2xl mb-2 shadow-lg" />
                <h2 class="text-xl font-bold text-purple-700">{{ clawStore.currentMachine?.name }}</h2>
                <p class="text-sm text-gray-400">{{ clawStore.currentMachine?.description }}</p>
            </div>

            <!-- 余额展示 -->
            <div class="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 mb-4 text-white">
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

            <!-- 充值包 -->
            <h3 class="font-bold text-gray-700 mb-2">充值游戏币</h3>
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div v-for="pkg in clawStore.rechargePackages" :key="pkg.id" @click="handleRecharge(pkg)"
                    class="bg-white rounded-2xl p-3 shadow text-center active:scale-95 transition-transform cursor-pointer relative">
                    <div v-if="pkg.bonus > 0"
                        class="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        +{{ pkg.bonus }}
                    </div>
                    <div class="text-2xl font-bold text-purple-600">{{ pkg.coins + pkg.bonus }}</div>
                    <div class="text-xs text-gray-400 mb-1">{{ pkg.label }}</div>
                    <div class="text-sm font-bold text-orange-500">¥{{ pkg.price }}</div>
                </div>
            </div>

            <!-- 投币开始 -->
            <div class="bg-white rounded-2xl p-4 shadow text-center">
                <p class="text-sm text-gray-500 mb-3">
                    本次游玩消耗 <span class="font-bold text-orange-500">{{ clawStore.currentMachine?.cost }} 币</span>
                </p>
                <button :disabled="!clawStore.canPlay" @click="goToModeSelect"
                    class="w-full py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-transform"
                    :class="clawStore.canPlay
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                        : 'bg-gray-200 text-gray-400'">
                    {{ clawStore.canPlay ? '投币开始' : '游戏币不足，请充值' }}
                </button>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段4: 模式选择 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'modeSelect'" class="flex-1 flex flex-col items-center justify-center px-6">
            <h2 class="text-xl font-bold text-purple-700 mb-2">投币成功！</h2>
            <p class="text-sm text-gray-400 mb-8">选择游玩方式</p>

            <div class="w-full space-y-4">
                <!-- 让TA玩 -->
                <div @click="startGame('ai')"
                    class="bg-white rounded-2xl p-5 shadow-lg active:scale-95 transition-transform cursor-pointer flex items-center gap-4">
                    <div class="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                        <img v-if="getCharAvatar(clawStore.invitedCharId)" :src="getCharAvatar(clawStore.invitedCharId)"
                            class="w-full h-full object-cover" @error="onAvatarError" />
                        <i v-else class="fa-solid fa-user text-white"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-gray-800">让TA玩</div>
                        <div class="text-xs text-gray-400">{{ clawStore.invitedCharName }} 来操控，你观看互动</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300"></i>
                </div>

                <!-- 自己玩 -->
                <div @click="startGame('self')"
                    class="bg-white rounded-2xl p-5 shadow-lg active:scale-95 transition-transform cursor-pointer flex items-center gap-4">
                    <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-2xl shrink-0">
                        <i class="fa-solid fa-gamepad text-white"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-bold text-gray-800">自己玩</div>
                        <div class="text-xs text-gray-400">你亲自操控方向和下勾</div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300"></i>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段5: 游戏界面 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'playing'" class="flex-1 flex flex-col overflow-hidden">
            <!-- 娃娃机可视化区域 -->
            <div class="flex-1 relative overflow-hidden bg-gray-50" ref="machineArea">
                <!-- 机台背景图：顶部裁剪 22%，把原图里的静态爪子裁掉，同时保持玻璃罩位置不变 -->
                <img :src="clawStore.currentMachine?.image"
                    class="absolute inset-x-0 top-0 w-full h-full object-cover"
                    style="clip-path: inset(22% 0 0 0);"
                    draggable="false" />

                <!-- 顶部天花板面板：柔和过渡裁剪边缘 -->
                <div class="absolute inset-x-0 top-0 h-[28%] pointer-events-none z-[5]"
                    style="background: linear-gradient(to bottom, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.9) 40%, rgba(255,255,255,0.5) 75%, transparent 100%); backdrop-filter: blur(12px);">
                </div>

                <!-- 底部水印遮罩 + 机身底部融合 -->
                <div class="absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-t from-gray-50 via-gray-50/70 to-transparent pointer-events-none z-[5]"></div>

                <!-- 玻璃罩暗角，增强纵深 -->
                <div class="absolute inset-0 pointer-events-none z-[4]"
                    style="background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.12) 100%);"></div>

                <!-- 顶部轨道 -->
                <div class="absolute top-[30%] left-[20%] right-[20%] h-1.5 bg-gradient-to-r from-gray-500/50 via-gray-400/70 to-gray-500/50 rounded-full shadow-sm pointer-events-none z-[6]"></div>

                <!-- 地面目标阴影：随爪子左右移动，给玩家明确落点 -->
                <div class="absolute bottom-[14%] left-0 right-0 h-6 pointer-events-none z-[6]">
                    <div class="absolute top-0 -translate-x-1/2 rounded-[100%] bg-black/20 blur-sm"
                        :style="{
                            left: clawStore.clawX + '%',
                            width: '56px',
                            height: '14px',
                            animation: 'pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        }">
                    </div>
                </div>

                <!-- 机内玩偶（严格在玻璃罩底部区域） -->
                <div class="absolute inset-0">
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
                        <img :src="doll.image" class="w-14 h-14 object-contain drop-shadow-lg" draggable="false" />
                    </div>
                </div>

                <!-- 准星：高亮当前对准的玩偶 -->
                <div v-if="targetDoll"
                    class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[25]"
                    :style="{
                        left: targetDoll.x + '%',
                        top: targetDoll.y + '%',
                    }">
                    <div class="w-16 h-16 rounded-full border-2 border-pink-400/70 bg-pink-400/10 animate-pulse"></div>
                </div>

                <!-- 被抓中的玩偶：跟随爪子上升 -->
                <div v-if="caughtDoll && (clawStore.clawState === 'grabbing' || clawStore.clawState === 'rising')"
                    class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2"
                    :style="{
                        left: clawStore.clawX + '%',
                        top: (clawStore.clawY + 5) + '%',
                        zIndex: 29,
                        transform: `translate(-50%, -50%) scale(${caughtDoll.scale})`,
                    }">
                    <img :src="caughtDoll.image" class="w-14 h-14 object-contain drop-shadow-lg" draggable="false" />
                </div>

                <!-- 爪子 + 绳索 -->
                <div class="absolute left-0 right-0 top-0 pointer-events-none" style="z-index: 30;">
                    <!-- 绳索：从顶部轨道到爪子顶部 -->
                    <div class="absolute -translate-x-1/2 rounded-full"
                        :style="{
                            left: clawStore.clawX + '%',
                            top: '30%',
                            width: '4px',
                            height: Math.max(0, clawStore.clawY - 30) + '%',
                            background: 'linear-gradient(to bottom, #374151, #9ca3af 60%, #d1d5db)',
                            boxShadow: '0 0 3px rgba(0,0,0,0.3)',
                        }">
                    </div>
                    <!-- 爪子本体 -->
                    <div class="absolute -translate-x-1/2 -translate-y-[30%]"
                        :style="{
                            left: clawStore.clawX + '%',
                            top: clawStore.clawY + '%',
                            transition: isClawAnimating ? 'none' : 'left 0.12s ease-out',
                            filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.45))',
                        }">
                        <!-- 发光外圈，让爪子在机台背景中不被淹没 -->
                        <div class="absolute -inset-3 rounded-full bg-gradient-to-b from-pink-400/50 to-purple-500/30 blur-lg -z-10 animate-pulse"></div>
                        <img src="/claw-machine-assets/claw/claw.webp"
                            class="w-28 h-auto object-contain"
                            :class="{
                                'claw-open': clawStore.clawState === 'dropping',
                                'claw-grip': clawStore.clawState === 'grabbing' || clawStore.clawState === 'rising',
                            }"
                            draggable="false" />
                    </div>
                </div>

                <!-- 操控者提示 -->
                <div class="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow flex items-center gap-1.5 backdrop-blur-sm"
                    :class="clawStore.controller === 'ai'
                        ? 'bg-pink-100/90 text-pink-600'
                        : 'bg-blue-100/90 text-blue-600'">
                    <i v-if="clawStore.controller === 'ai'" class="fa-solid fa-robot"></i>
                    <i v-else class="fa-solid fa-gamepad"></i>
                    <span>{{ clawStore.controller === 'ai' ? clawStore.invitedCharName + ' 操控中' : '你操控中' }}</span>
                </div>

                <!-- AI 思考提示 -->
                <div v-if="clawStore.aiThinking" class="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/90 text-xs text-gray-500 shadow backdrop-blur-sm">
                    <i class="fa-solid fa-spinner fa-spin mr-1"></i>{{ clawStore.invitedCharName }} 思考中...
                </div>

                <!-- 自己玩控制区：摇杆 + 抓取按钮 -->
                <div v-if="clawStore.controller === 'user' && clawStore.clawState === 'idle'"
                    class="absolute bottom-4 left-0 right-0 flex items-end justify-between px-8 pb-2">
                    <!-- 摇杆盘 -->
                    <div class="relative flex flex-col items-center gap-2">
                        <div class="relative w-24 h-24 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 shadow-xl border-4 border-gray-300 flex items-center justify-center overflow-hidden">
                            <!-- 底盘凹槽 -->
                            <div class="absolute w-[72px] h-[72px] rounded-full bg-gradient-to-b from-gray-300 to-gray-400 shadow-inner"></div>
                            <!-- 可动的杆头 -->
                            <div class="relative w-11 h-11 rounded-full bg-gradient-to-b from-pink-400 to-purple-500 shadow-lg border-2 border-white/50 transition-transform duration-100 ease-out"
                                :style="{ transform: `translateX(${(clawStore.clawX - 50) * 0.45}px)` }">
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button @click="moveLeft" :disabled="clawStore.clawState !== 'idle'"
                                class="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-lg text-purple-600 active:scale-90 transition-transform">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <span class="text-[10px] text-gray-500 font-medium">左右移动</span>
                            <button @click="moveRight" :disabled="clawStore.clawState !== 'idle'"
                                class="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-lg text-purple-600 active:scale-90 transition-transform">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- 抓取按钮 -->
                    <button @click="handleDrop" :disabled="clawStore.clawState !== 'idle'"
                        class="w-[88px] h-[88px] rounded-full bg-gradient-to-b from-red-500 to-red-700 text-white font-bold shadow-2xl active:scale-90 transition-transform border-[5px] border-red-300 flex flex-col items-center justify-center mb-4">
                        <i class="fa-solid fa-hand-rock text-2xl mb-0.5"></i>
                        <span class="text-sm">抓</span>
                    </button>
                </div>

                <!-- AI 操作中提示 -->
                <div v-if="clawStore.controller === 'ai' && clawStore.clawState !== 'idle'"
                    class="absolute bottom-5 left-0 right-0 text-center">
                    <span class="px-3 py-1 rounded-full bg-white/90 text-xs text-gray-500 shadow backdrop-blur-sm">
                        {{ getClawStateText() }}
                    </span>
                </div>
            </div>

            <!-- 聊天区域 -->
            <div class="h-[180px] bg-white border-t border-gray-100 flex flex-col shrink-0">
                <!-- 聊天消息 -->
                <div class="flex-1 overflow-y-auto px-3 py-2 space-y-2" ref="chatContainer">
                    <div v-for="msg in clawStore.gameChatMessages" :key="msg.id"
                        class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                        <div class="max-w-[75%] px-3 py-1.5 rounded-2xl text-sm"
                            :class="msg.role === 'user'
                                ? 'bg-purple-500 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-700 rounded-bl-sm'">
                            {{ msg.content }}
                        </div>
                    </div>
                    <div v-if="clawStore.aiThinking && streamingText" class="flex justify-start">
                        <div class="max-w-[75%] px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-700 rounded-bl-sm text-sm">
                            {{ streamingText }}<span class="animate-pulse">▋</span>
                        </div>
                    </div>
                </div>
                <!-- 聊天输入 -->
                <div class="flex items-center gap-2 px-3 py-2 border-t border-gray-50">
                    <input v-model="chatInput" @keydown.enter="sendChat" type="text"
                        placeholder="说点什么..."
                        class="flex-1 px-3 py-2 rounded-full bg-gray-50 text-sm outline-none focus:ring-2 ring-purple-200" />
                    <button @click="sendChat" :disabled="!chatInput.trim() || clawStore.aiThinking"
                        class="w-9 h-9 rounded-full bg-purple-500 text-white flex items-center justify-center disabled:opacity-40">
                        <i class="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 阶段6: 结果展示 -->
        <!-- ============================================================ -->
        <div v-else-if="clawStore.gamePhase === 'result'" class="flex-1 flex flex-col items-center justify-center px-6">
            <div v-if="clawStore.lastGrabResult?.success" class="text-center">
                <h2 class="text-2xl font-bold text-pink-600 mb-2">抓到了！</h2>
                <div class="w-40 h-40 mx-auto mb-3 bg-white rounded-2xl shadow-lg flex items-center justify-center p-4 animate-bounce">
                    <img :src="clawStore.lastGrabResult.doll.image" class="w-full h-full object-contain" />
                </div>
                <p class="text-lg font-bold text-gray-700">{{ clawStore.lastGrabResult.doll.name }}</p>
                <p class="text-xs text-gray-400 mt-1">来自 {{ clawStore.currentMachine?.name }}</p>
                <p class="text-xs text-gray-400">已收入展馆</p>
            </div>
            <div v-else class="text-center">
                <div class="w-24 h-24 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <i class="fa-regular fa-face-frown text-5xl text-gray-300"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-400 mb-2">没抓到...</h2>
                <p class="text-sm text-gray-400">差一点点，下次一定行！</p>
            </div>

            <!-- AI 聊天反应 -->
            <div v-if="clawStore.gameChatMessages.length > 0" class="w-full mt-4 bg-white rounded-2xl p-3 shadow max-h-[200px] overflow-y-auto">
                <div v-for="msg in clawStore.gameChatMessages.slice(-3)" :key="msg.id"
                    class="flex mb-1.5" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
                    <div class="max-w-[80%] px-2.5 py-1 rounded-xl text-xs"
                        :class="msg.role === 'user' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'">
                        {{ msg.content }}
                    </div>
                </div>
            </div>

            <!-- 抢夺操控权 -->
            <div class="w-full mt-6 space-y-2">
                <p class="text-center text-sm text-gray-400">下一轮谁来操控？</p>
                <div class="flex gap-3">
                    <button @click="claimControl('user')"
                        class="flex-1 py-2.5 rounded-2xl bg-blue-500 text-white font-bold text-sm shadow active:scale-95 transition-transform flex items-center justify-center gap-1">
                        <i class="fa-solid fa-gamepad"></i> 我来
                    </button>
                    <button @click="claimControl('ai')"
                        class="flex-1 py-2.5 rounded-2xl bg-pink-500 text-white font-bold text-sm shadow active:scale-95 transition-transform flex items-center justify-center gap-1">
                        <i class="fa-solid fa-robot"></i> 让TA来
                    </button>
                </div>
                <button @click="exitToSelecting" class="w-full py-2 text-sm text-gray-400">
                    返回选机子
                </button>
            </div>
        </div>

        <!-- ============================================================ -->
        <!-- 展馆弹窗 -->
        <!-- ============================================================ -->
        <div v-if="showExhibition" class="fixed inset-0 bg-black/50 z-50 flex items-end" @click.self="showExhibition = false">
            <div class="w-full h-[80%] bg-gradient-to-b from-amber-50 to-orange-50 rounded-t-3xl flex flex-col">
                <div class="flex items-center justify-between p-4 border-b border-amber-100">
                    <h2 class="text-lg font-bold text-amber-700 flex items-center gap-1">
                        <i class="fa-solid fa-trophy"></i> 我的展馆
                    </h2>
                    <button @click="showExhibition = false" class="w-8 h-8 flex items-center justify-center text-gray-400">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 relative" ref="exhibitionArea">
                    <div v-if="clawStore.exhibition.length === 0" class="text-center text-gray-400 py-12">
                        <i class="fa-solid fa-trophy text-5xl mb-2"></i>
                        <p>展馆空空如也</p>
                        <p class="text-xs mt-1">去抓几个娃娃回来吧～</p>
                    </div>
                    <!-- 展品 -->
                    <div v-for="item in clawStore.exhibition" :key="item.id"
                        class="absolute cursor-move group"
                        :style="{ left: item.position.x + '%', top: item.position.y + '%' }"
                        @mousedown="startDrag($event, item)" @touchstart="startDrag($event, item)">
                        <div class="relative">
                            <img :src="item.dollImage" class="w-16 h-16 object-contain drop-shadow-lg" />
                            <div class="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button @click.stop="clawStore.removeFromExhibition(item.id)"
                                    class="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <div class="text-[10px] text-center text-gray-400 mt-0.5 max-w-[64px] truncate">{{ item.dollName }}</div>
                        </div>
                    </div>
                </div>
                <div class="p-3 border-t border-amber-100 flex justify-between items-center">
                    <span class="text-xs text-gray-400">长按拖拽可移动位置</span>
                    <button v-if="clawStore.exhibition.length > 0" @click="confirmClearExhibition"
                        class="text-xs text-red-400">清空展馆</button>
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

                <!-- 预览 -->
                <div v-if="customPreview" class="w-32 h-32 mx-auto mb-4 bg-gray-50 rounded-2xl flex items-center justify-center p-2">
                    <img :src="customPreview" class="w-full h-full object-contain" />
                </div>

                <!-- 已有自定义玩偶 -->
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
        <div v-if="toastMessage" class="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm shadow-lg"
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
import { compressImage } from '../../utils/imageUtils.js'
import { findNearestDoll } from '../../utils/clawMachine/ClawMachineEngine.js'

const router = useRouter()
const clawStore = useClawMachineStore()
const chatStore = useChatStore()
const walletStore = useWalletStore()

// ============================================================
// 本地状态
// ============================================================
const showExhibition = ref(false)
const customUploadMachineId = ref(null)
const customPreview = ref(null)
const customUploading = ref(false)
const chatInput = ref('')
const streamingText = ref('')
const toastMessage = ref('')
const toastType = ref('info')
const exhibitionArea = ref(null)
const chatContainer = ref(null)

// ============================================================
// 计算属性
// ============================================================

const walletBalance = computed(() => (walletStore.balance || 0).toFixed(2))

const contactList = computed(() => {
    return (chatStore.contactList || []).filter(c => !c.isGroup)
})

/** 当前被抓中的玩偶（用于跟随爪子上升动画） */
const caughtDoll = computed(() => {
    if (!clawStore.lastGrabResult?.success || !clawStore.lastGrabResult.doll) return null
    return clawStore.lastGrabResult.doll
})

/** 爪子是否正在动画中 */
const isClawAnimating = computed(() => {
    return ['moving', 'dropping', 'grabbing', 'rising'].includes(clawStore.clawState)
})

/** 当前对准的目标玩偶（仅自己玩且静止时显示） */
const targetDoll = computed(() => {
    if (clawStore.controller !== 'user' || clawStore.clawState !== 'idle') return null
    if (!clawStore.machineLayout.length) return null
    const nearest = findNearestDoll(clawStore.machineLayout, clawStore.clawX, 78)
    return nearest && nearest.distance <= 13 ? nearest.doll : null
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

function onAvatarError(e) {
    e.target.style.display = 'none'
}

function getClawStateText() {
    const state = clawStore.clawState
    const texts = {
        moving: '移动中...',
        dropping: '下勾中...',
        grabbing: '抓取中...',
        rising: '上升中...',
        result: '出结果了！',
    }
    return texts[state] || ''
}

// ============================================================
// 阶段1: 邀请角色
// ============================================================

function selectChar(char) {
    clawStore.setInvitedChar(char.id, char.name)
}

function goToSelecting() {
    clawStore.gamePhase = 'selecting'
}

// ============================================================
// 阶段2: 选机子
// ============================================================

function enterMachine(machineId) {
    clawStore.selectMachine(machineId)
    clawStore.gamePhase = 'charging'
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
        // 先预览原图
        const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 })
        customPreview.value = compressed

        // 上传+抠像
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

// ============================================================
// 阶段3: 充值投币
// ============================================================

function handleRecharge(pkg) {
    const result = clawStore.rechargeCoins(pkg)
    showToast(result.message, result.success ? 'info' : 'error')
}

function goToModeSelect() {
    clawStore.gamePhase = 'modeSelect'
}

// ============================================================
// 阶段4: 开始游戏
// ============================================================

async function startGame(mode) {
    const success = clawStore.startGame(mode)
    if (!success) {
        showToast('游戏币不足！', 'error')
        clawStore.gamePhase = 'charging'
        return
    }

    // 如果是 AI 模式，自动执行 AI 游玩
    if (mode === 'ai') {
        await playAITurn()
    }
}

// ============================================================
// 自己玩：爪子控制
// ============================================================

function moveLeft() {
    // 玩偶列间距约 9.6%，步长 4.8% 让玩家可以一左/一右精准对齐列
    clawStore.moveClaw('left', 4.8)
}

function moveRight() {
    clawStore.moveClaw('right', 4.8)
}

async function handleDrop() {
    if (clawStore.clawState !== 'idle') return

    // 1. 下降动画：爪子张开下落到玩偶层
    clawStore.setClawState('dropping')
    await animateClawDrop()

    // 2. 在底部短暂停顿，让玩家看清落点
    await delay(180)

    // 3. 判定结果（爪子到达底部瞬间判定）
    clawStore.dropClaw()

    // 4. 抓取动画：爪子闭合
    clawStore.setClawState('grabbing')
    await delay(500)

    // 5. 上升动画：把玩偶（或空爪）提上来
    clawStore.setClawState('rising')
    await animateClawRise()

    // 6. 结果展示
    clawStore.setClawState('result')
    clawStore.gamePhase = 'result'

    // 7. AI 反应
    if (clawStore.invitedCharId) {
        await clawStore.fetchAIReaction()
    }
}

async function animateClawDrop() {
    const startY = clawStore.clawY
    // 下降到玩偶层更下方，确保视觉上明显"伸下去"
    const targetY = 78
    const duration = 900
    const startTime = Date.now()

    return new Promise(resolve => {
        function step() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            // ease-in-out：启动和停止都柔和
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
    const targetY = 44
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
    // 1. 开场白
    await clawStore.fetchAIOpening()

    // 2. AI 操作
    const { steps } = clawStore.performAIPlay({ aiSkill: 0.55 })

    // 3. 逐步执行操作动画
    for (const step of steps) {
        if (step.type === 'move') {
            clawStore.setClawState('moving')
            await animateClawMove(step.x, step.duration)
        } else if (step.type === 'drop') {
            // 下勾动画
            clawStore.setClawState('dropping')
            await animateClawDrop()
            clawStore.setClawState('grabbing')
            await delay(500)
            clawStore.setClawState('rising')
            await animateClawRise()
        }
    }

    // 4. 结果展示
    clawStore.setClawState('result')
    clawStore.gamePhase = 'result'

    // 5. AI 反应
    await clawStore.fetchAIReaction()
}

async function animateClawMove(targetX, duration) {
    const startX = clawStore.clawX
    const startTime = Date.now()

    return new Promise(resolve => {
        function step() {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
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
    await scrollChatToBottom()
}

// 自动滚动聊天到底部
async function scrollChatToBottom() {
    await nextTick()
    if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
}

watch(() => clawStore.gameChatMessages.length, scrollChatToBottom)

// ============================================================
// 抢夺操控权
// ============================================================

function claimControl(who) {
    clawStore.setController(who)

    if (who === 'ai') {
        // AI 操控：投币 + 自动执行
        if (!clawStore.canPlay) {
            showToast('游戏币不足！', 'error')
            clawStore.gamePhase = 'charging'
            return
        }
        clawStore.startGame('ai')
        playAITurn()
    } else {
        // 用户操控：投币 + 进入游戏
        if (!clawStore.canPlay) {
            showToast('游戏币不足！', 'error')
            clawStore.gamePhase = 'charging'
            return
        }
        clawStore.startGame('self')
    }
}

function exitToSelecting() {
    clawStore.resetSession()
    clawStore.invitedCharId = null
    clawStore.invitedCharName = null
    clawStore.gamePhase = 'idle'
}

// ============================================================
// 展馆拖拽
// ============================================================

function startDrag(e, item) {
    e.preventDefault()
    e.stopPropagation()
    const container = exhibitionArea.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    const isTouch = e.type === 'touchstart'
    const startX = isTouch ? e.touches[0].clientX : e.clientX
    const startY = isTouch ? e.touches[0].clientY : e.clientY
    const origX = item.position.x
    const origY = item.position.y

    function onMove(ev) {
        ev.preventDefault()
        const clientX = isTouch ? ev.touches[0].clientX : ev.clientX
        const clientY = isTouch ? ev.touches[0].clientY : ev.clientY
        const dx = ((clientX - startX) / rect.width) * 100
        const dy = ((clientY - startY) / rect.height) * 100
        item.position.x = Math.max(2, Math.min(92, origX + dx))
        item.position.y = Math.max(2, Math.min(92, origY + dy))
    }

    function onEnd() {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onEnd)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
        clawStore.updateExhibitPosition(item.id, { ...item.position })
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
}

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
    if (clawStore.gamePhase === 'playing') {
        if (confirm('游戏进行中，确定要退出吗？')) {
            clawStore.cancelAI()
            clawStore.resetSession()
            router.push('/games')
        }
    } else if (clawStore.gamePhase === 'idle') {
        router.push('/games')
    } else if (clawStore.gamePhase === 'selecting') {
        clawStore.gamePhase = 'idle'
    } else if (clawStore.gamePhase === 'charging' || clawStore.gamePhase === 'modeSelect') {
        clawStore.gamePhase = 'selecting'
    } else if (clawStore.gamePhase === 'result') {
        clawStore.replay()
    } else {
        router.push('/games')
    }
}

// ============================================================
// 生命周期
// ============================================================

onMounted(() => {
    // 初始化游戏阶段
    if (clawStore.gamePhase === 'idle' && !clawStore.invitedCharId) {
        clawStore.gamePhase = 'idle'
    }
})

onUnmounted(() => {
    clawStore.cancelAI()
})
</script>

<style scoped>
/* 爪子抓紧动画：抓到玩偶时轻微收缩 */
@keyframes claw-grip {
    0% { transform: translate(-50%, -30%) scale(1); }
    30% { transform: translate(-50%, -30%) scale(0.92); }
    50% { transform: translate(-50%, -30%) scale(0.95); }
    70% { transform: translate(-50%, -30%) scale(0.92); }
    100% { transform: translate(-50%, -30%) scale(0.95); }
}

.claw-grip {
    animation: claw-grip 0.4s ease-in-out forwards;
}

/* 爪子张开动画：下勾时张开 */
@keyframes claw-open {
    0% { transform: translate(-50%, -30%) scale(1) rotate(0deg); }
    100% { transform: translate(-50%, -30%) scale(1.1) rotate(-3deg); }
}

.claw-open {
    animation: claw-open 0.3s ease-out forwards;
}

/* 选中目标玩偶时的高亮 */
@keyframes doll-highlight {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.8)); }
}
</style>
