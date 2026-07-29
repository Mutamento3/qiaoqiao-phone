<template>
    <div class="emoji-picker h-[280px] bg-[#f5f5f5] border-t border-[#dcdcdc] flex flex-col animate-slide-up"
        @click.stop>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">

            <!-- Tab 1: System Emoji -->
            <div v-if="activeTab === 'emoji'" class="grid grid-cols-8 gap-2">
                <div v-for="emoji in simpleEmojiList" :key="emoji"
                    class="text-2xl cursor-pointer hover:bg-gray-200 rounded p-1 flex items-center justify-center transition-colors select-none"
                    @click="$emit('select-emoji', emoji)">
                    {{ emoji }}
                </div>
            </div>

            <!-- Tab 2: Custom Stickers -->
            <div v-else-if="activeTab === 'sticker'">
                <!-- Scope Selector -->
                <div class="flex gap-2 mb-3 bg-white p-1 rounded-lg border border-gray-200">
                    <div class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                        :class="activeScope === 'global' ? 'bg-gray-100 font-bold text-black' : 'text-gray-500 hover:bg-gray-50'"
                        @click="activeScope = 'global'">全局通用</div>
                    <div class="flex-1 text-center text-xs py-1.5 rounded cursor-pointer transition-colors"
                        :class="activeScope !== 'global' ? 'bg-orange-50 font-bold text-[#ea5f39]' : 'text-gray-500 hover:bg-gray-50'"
                        @click="activeScope = chatStore.currentChatId">{{ chatStore.chats[chatStore.currentChatId]?.name
                            || '当前角色' }}专属</div>
                </div>

                <!-- Search Bar -->
                <div class="mb-3 relative">
                    <input v-model="searchQuery" type="text" placeholder="搜索表情包..."
                        class="w-full px-3 py-2 pl-9 pr-8 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all">
                    <i class="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <button v-if="searchQuery" @click="searchQuery = ''"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- Category Filter -->
                <div class="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button @click="selectedCategory = null"
                        class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0"
                        :class="selectedCategory === null ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'">
                        全部
                    </button>
                    <button v-for="cat in availableCategories" :key="cat" @click="selectedCategory = cat"
                        class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0"
                        :class="selectedCategory === cat ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'">
                        {{ cat }}
                    </button>
                </div>

                <div class="grid grid-cols-4 gap-4">
                    <!-- Add Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="triggerUpload">
                        <i class="fa-solid fa-plus text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">添加</span>
                    </div>

                    <!-- Batch Add Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="showBatchModal = true">
                        <i class="fa-solid fa-file-import text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">批量</span>
                    </div>

                    <!-- Settings Button -->
                    <div class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="toggleDeleteMode">
                        <i class="fa-solid fa-gear text-gray-400 text-2xl"></i>
                        <span class="text-xs text-gray-400 mt-1">{{ isDeleteMode ? '取消' : '设置' }}</span>
                    </div>

                    <!-- Clear Category Button -->
                    <div v-if="isDeleteMode && selectedCategory" class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="clearCategory">
                        <i class="fa-solid fa-trash-can text-red-400 text-2xl"></i>
                        <span class="text-xs text-red-400 mt-1">清空分类</span>
                    </div>
                    <div v-else-if="isDeleteMode" class="aspect-square bg-white border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition"
                        @click="clearAllStickers">
                        <i class="fa-solid fa-trash-can text-red-400 text-2xl"></i>
                        <span class="text-xs text-red-400 mt-1">清空全部</span>
                    </div>

                    <!-- Sticker List (Filtered) -->
                    <div v-for="sticker in filteredStickers" :key="sticker.url"
                        class="relative group flex flex-col items-center gap-1">
                        <div class="aspect-square w-full bg-white rounded-lg border border-gray-200 cursor-pointer overflow-hidden p-2 relative"
                            @click="isDeleteMode ? toggleStickerSelection(sticker) : $emit('select-sticker', sticker)">
                            <img :src="sticker.url" class="w-full h-full object-contain">

                            <!-- Selection Checkbox -->
                            <div v-if="isDeleteMode" class="absolute top-1 left-1 w-5 h-5 bg-white/80 flex items-center justify-center rounded-full cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    :checked="selectedStickers.includes(sticker.url)"
                                    @change="toggleStickerSelection(sticker)"
                                    class="w-4 h-4 rounded-full appearance-none bg-white border-2 border-gray-300 checked:bg-blue-500 checked:border-blue-500 relative"
                                >
                                <div v-if="selectedStickers.includes(sticker.url)" class="absolute inset-0 flex items-center justify-center text-white text-xs">
                                    <i class="fa-solid fa-check"></i>
                                </div>
                            </div>
                        </div>
                        <!-- Sticker Name with Category Badge -->
                        <div class="w-full flex flex-col items-center gap-0.5">
                            <span class="text-[10px] text-gray-500 truncate w-full text-center">{{ getDisplayName(sticker.name) }}</span>
                            <span v-if="sticker.category"
                                class="text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{{
                                    sticker.category }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Notification -->
            <div v-if="toastMessage"
                class="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs transition-opacity animate-fade-in z-50">
                {{ toastMessage }}
            </div>
            
            <!-- Delete Mode Actions -->
            <div v-if="isDeleteMode && selectedStickers.length > 0" class="absolute bottom-16 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-2 animate-fade-in">
                <button @click="deleteSelectedStickers" class="w-full bg-red-500 text-white py-2 rounded font-medium text-sm">
                    删除选中 ({{ selectedStickers.length }})
                </button>
            </div>
            
            <!-- Confirm Modal -->
            <div v-if="showConfirmModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
                <div class="bg-white w-[80%] max-w-[280px] rounded-lg shadow-xl">
                    <div class="p-4 text-center">
                        <div class="text-base text-gray-800 mb-4">{{ confirmMessage }}</div>
                        <div class="flex gap-2 justify-center">
                            <button 
                                @click="showConfirmModal = false; confirmCallback = null" 
                                class="px-4 py-2 bg-gray-100 text-gray-600 rounded font-medium text-sm"
                            >
                                取消
                            </button>
                            <button 
                                @click="handleConfirmAction" 
                                class="px-4 py-2 bg-red-500 text-white rounded font-medium text-sm"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        <!-- Bottom Tab Bar -->
        <div class="h-[40px] border-t border-[#e5e5e5] bg-white flex items-center">
            <!-- Emoji Tab -->
            <div class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
                :class="activeTab === 'emoji' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'" @click="activeTab = 'emoji'">
                <i class="fa-regular fa-face-smile text-xl"
                    :class="activeTab === 'emoji' ? 'text-[#07c160]' : 'text-gray-500'"></i>
            </div>

            <!-- Sticker Tab -->
            <div class="flex-1 h-full flex items-center justify-center cursor-pointer transition-colors"
                :class="activeTab === 'sticker' ? 'bg-[#f0f0f0]' : 'hover:bg-[#f9f9f9]'" @click="activeTab = 'sticker'">
                <i class="fa-regular fa-heart text-xl"
                    :class="activeTab === 'sticker' ? 'text-[#ea5f39]' : 'text-gray-500'"></i>
            </div>

        </div>

        <!-- Hidden Input (支持多选) -->
        <input type="file" ref="fileInput" class="hidden" accept="image/*" multiple @change="handleFileChange">

        <!-- Single Upload Modal (custom name + optional category) -->
        <div v-if="showUploadModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
            <div class="bg-white w-[85%] max-w-[300px] max-h-[85vh] rounded-lg shadow-xl overflow-hidden flex flex-col">
                <div class="p-4 overflow-y-auto custom-scrollbar">
                    <div class="font-bold text-gray-700 text-center mb-3 flex-shrink-0">添加表情包</div>

                    <!-- Preview + OCR Button -->
                    <div v-if="pendingFilePreview" class="flex flex-col items-center mb-3">
                        <img :src="pendingFilePreview" class="w-24 h-24 object-contain border border-gray-200 rounded-lg p-1">
                        <button
                            @click="autoRecognizeName"
                            :disabled="isOcrLoading"
                            class="mt-2 text-xs px-3 py-1 rounded-full flex items-center gap-1 transition-colors"
                            :class="isOcrLoading
                                ? 'bg-gray-100 text-gray-400'
                                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'"
                        >
                            <i v-if="isOcrLoading" class="fa-solid fa-spinner fa-spin"></i>
                            <i v-else class="fa-solid fa-wand-magic-sparkles"></i>
                            {{ isOcrLoading ? '本地识别中...' : '本地识别文字' }}
                        </button>
                    </div>

                    <!-- Custom Name Input -->
                    <div class="mb-3">
                        <label class="text-xs text-gray-600 mb-1 block">名称 (可选)</label>
                        <input
                            v-model="customStickerName"
                            type="text"
                            :placeholder="defaultStickerName"
                            maxlength="30"
                            class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all"
                        >
                    </div>

                    <!-- Category Input (optional) -->
                    <div class="mb-3">
                        <label class="text-xs text-gray-600 mb-1 block">分类标签 (可选)</label>
                        <div class="relative">
                            <button
                                @click="showUploadCategoryMenu = !showUploadCategoryMenu"
                                class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                            >
                                <span :class="uploadCategory ? '' : 'text-gray-400'">{{ uploadCategory || '选择或新建分类标签' }}</span>
                                <i class="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                            </button>
                            <div v-if="showUploadCategoryMenu" class="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                                <div class="p-2">
                                    <button
                                        @click="uploadCategory = ''; showUploadCategoryMenu = false"
                                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded mb-1 text-gray-500"
                                    >
                                        不设分类
                                    </button>
                                    <button
                                        v-for="cat in availableCategories"
                                        :key="cat"
                                        @click="uploadCategory = cat; showUploadCategoryMenu = false"
                                        class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded mb-1"
                                    >
                                        {{ cat }}
                                    </button>
                                    <div class="text-xs text-gray-500 mb-1 px-2 mt-2">新建标签</div>
                                    <div class="flex gap-1">
                                        <input
                                            v-model="newUploadCategoryName"
                                            type="text"
                                            placeholder="输入新标签名称"
                                            class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                                        >
                                        <button
                                            @click="addNewUploadCategory"
                                            class="px-3 py-1.5 text-sm bg-orange-500 text-white rounded"
                                        >
                                            <i class="fa-solid fa-plus text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tag-as-Prefix Checkbox -->
                    <div v-if="uploadCategory" class="mb-4 flex items-center gap-2">
                        <input
                            v-model="useTagAsPrefix"
                            type="checkbox"
                            id="tagPrefix"
                            class="w-4 h-4 rounded appearance-none bg-white border-2 border-gray-300 checked:bg-orange-500 checked:border-orange-500 relative cursor-pointer"
                        >
                        <label for="tagPrefix" class="text-xs text-gray-600 cursor-pointer">
                            标签作为名字前缀<br>
                            <span class="text-gray-400">最终名: {{ uploadCategory }}-{{ customStickerName || defaultStickerName }}</span>
                        </label>
                    </div>

                    <div class="flex gap-2 justify-center">
                        <button
                            @click="cancelUpload"
                            :disabled="isUploading"
                            class="px-4 py-2 bg-gray-100 text-gray-600 rounded font-medium text-sm disabled:opacity-50"
                        >
                            取消
                        </button>
                        <button
                            @click="confirmUpload"
                            :disabled="isUploading"
                            class="px-4 py-2 bg-orange-500 text-white rounded font-medium text-sm disabled:opacity-50 flex items-center gap-1"
                        >
                            <i v-if="isUploading" class="fa-solid fa-spinner fa-spin text-xs"></i>
                            {{ isUploading ? '上传中...' : '确认添加' }}
                        </button>
                    </div>
                    <div class="text-[10px] text-gray-400 text-center mt-2">图床国内不可用, 已自动改本地存储</div>
                </div>
            </div>
        </div>

        <!-- Batch OCR Modal (多选文件 + 逐个 OCR + 可编辑 + 批量上传) -->
        <div v-if="showBatchOcrModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fade-in">
            <div class="bg-white w-[92%] max-w-[400px] max-h-[88vh] rounded-lg shadow-xl overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="p-3 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                    <span class="font-bold text-gray-700 text-sm">批量上传 ({{ batchOcrItems.length }}个)</span>
                    <button
                        @click="!isBatchUploading && !isBatchOcrRunning && _closeBatchOcrModal()"
                        :disabled="isBatchUploading || isBatchOcrRunning"
                        class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Category + Prefix -->
                <div class="p-3 border-b border-gray-200 flex-shrink-0">
                    <div class="flex gap-2 items-center mb-2">
                        <span class="text-xs text-gray-600 shrink-0">分类:</span>
                        <input
                            v-model="batchOcrCategory"
                            type="text"
                            placeholder="可选, 输入或选现有"
                            class="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-200"
                        >
                    </div>
                    <label v-if="batchOcrCategory" class="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input
                            v-model="batchOcrUsePrefix"
                            type="checkbox"
                            class="w-3.5 h-3.5 rounded appearance-none bg-white border-2 border-gray-300 checked:bg-orange-500 checked:border-orange-500 relative cursor-pointer"
                        >
                        标签作为名字前缀 ({{ batchOcrCategory }}-名字)
                    </label>
                </div>

                <!-- File List -->
                <div class="flex-1 overflow-y-auto p-2 custom-scrollbar">
                    <div
                        v-for="(item, idx) in batchOcrItems"
                        :key="idx"
                        class="flex items-center gap-2 p-2 mb-1.5 border border-gray-100 rounded-lg hover:bg-gray-50"
                    >
                        <!-- 缩略图 -->
                        <img :src="item.preview" class="w-12 h-12 object-contain border border-gray-200 rounded shrink-0">

                        <!-- 名字输入 + 状态 -->
                        <div class="flex-1 min-w-0">
                            <input
                                v-model="item.name"
                                type="text"
                                :placeholder="item.file.name?.split('.').slice(0,-1).join('.') || '名字'"
                                maxlength="30"
                                :disabled="item.status === 'done' || item.status === 'uploading'"
                                class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-200 disabled:bg-gray-100"
                            >
                            <div class="text-[10px] mt-0.5" :class="{
                                'text-gray-400': item.status === 'pending',
                                'text-blue-500': item.status === 'ocr-ing',
                                'text-green-600': item.status === 'ocr-done' || item.status === 'done',
                                'text-red-500': item.status === 'ocr-fail' || item.status === 'fail',
                                'text-orange-500': item.status === 'uploading',
                            }">
                                <span v-if="item.status === 'pending'">待识别</span>
                                <span v-else-if="item.status === 'ocr-ing'"><i class="fa-solid fa-spinner fa-spin"></i> 识别中</span>
                                <span v-else-if="item.status === 'ocr-done'">已识别</span>
                                <span v-else-if="item.status === 'ocr-fail'">识别失败 (无文字?)</span>
                                <span v-else-if="item.status === 'uploading'"><i class="fa-solid fa-spinner fa-spin"></i> 上传中</span>
                                <span v-else-if="item.status === 'done'"><i class="fa-solid fa-check"></i> 已上传</span>
                                <span v-else-if="item.status === 'fail'">上传失败</span>
                            </div>
                        </div>

                        <!-- 单个 OCR 按钮 -->
                        <button
                            v-if="item.status === 'pending' || item.status === 'ocr-fail'"
                            @click="ocrSingleItem(idx)"
                            :disabled="item.status === 'ocr-ing' || isBatchOcrRunning"
                            class="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-40 shrink-0"
                        >
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </button>

                        <!-- 删除按钮 (未上传的) -->
                        <button
                            v-if="item.status !== 'done' && item.status !== 'uploading' && !isBatchUploading"
                            @click="removeBatchItem(idx)"
                            class="text-xs px-1.5 py-1 rounded text-gray-400 hover:text-red-500 shrink-0"
                        >
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="p-3 border-t border-gray-200 flex gap-2 flex-shrink-0">
                    <button
                        @click="ocrAllItems"
                        :disabled="isBatchOcrRunning || isBatchUploading"
                        class="flex-1 px-3 py-2 bg-blue-500 text-white rounded font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                        <i v-if="isBatchOcrRunning" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-wand-magic-sparkles"></i>
                        {{ isBatchOcrRunning ? '本地识别中...' : '全部本地识别' }}
                    </button>
                    <button
                        @click="batchUploadAll"
                        :disabled="isBatchUploading || isBatchOcrRunning"
                        class="flex-1 px-3 py-2 bg-orange-500 text-white rounded font-medium text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                        <i v-if="isBatchUploading" class="fa-solid fa-spinner fa-spin"></i>
                        <i v-else class="fa-solid fa-upload"></i>
                        {{ isBatchUploading ? '上传中...' : '全部上传' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Batch Import Modal -->
        <div v-if="showBatchModal" class="absolute inset-0 bg-white z-50 flex flex-col p-4 animate-fade-in">
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-gray-700">批量导入表情包</span>
                <button @click="showBatchModal = false" class="text-gray-400 hover:text-gray-600"><i
                        class="fa-solid fa-xmark text-xl"></i></button>
            </div>

            <!-- Category Input -->
            <div class="mb-3">
                <label class="text-xs text-gray-600 mb-1 block">分类标签 (可选)</label>
                <div class="relative">
                    <button 
                        @click="showCategoryMenu = !showCategoryMenu"
                        class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                    >
                        <span>{{ batchCategory || '选择或新建分类标签' }}</span>
                        <i class="fa-solid fa-chevron-down text-gray-400 text-xs"></i>
                    </button>
                    <div v-if="showCategoryMenu" class="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-40 overflow-y-auto">
                        <div class="p-2">
                            <div class="text-xs text-gray-500 mb-1 px-2">现有标签</div>
                            <button 
                                v-for="cat in availableCategories" 
                                :key="cat"
                                @click="batchCategory = cat; showCategoryMenu = false"
                                class="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 rounded mb-1"
                            >
                                {{ cat }}
                            </button>
                            <div class="text-xs text-gray-500 mb-1 px-2 mt-2">新建标签</div>
                            <div class="flex gap-1">
                                <input 
                                    v-model="newCategoryName" 
                                    type="text" 
                                    placeholder="输入新标签名称"
                                    class="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
                                >
                                <button 
                                    @click="addNewCategory" 
                                    class="px-3 py-1.5 text-sm bg-orange-500 text-white rounded"
                                >
                                    <i class="fa-solid fa-plus text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-xs text-gray-500 mb-2">格式：名称：URL (每行一个)</div>
            <textarea v-model="batchInput"
                class="flex-1 border border-gray-200 rounded p-2 text-xs resize-none outline-none focus:border-green-500 mb-3"
                placeholder="示例：&#10;开心：https://example.com/1.png&#10;难过：https://example.com/2.png"></textarea>
            <div class="flex gap-2">
                <button @click="handleBatchImport"
                    class="flex-1 bg-[#07c160] text-white py-2 rounded font-medium active:bg-[#06ad56]">导入</button>
                <button @click="triggerTxtImport"
                    class="flex-1 bg-blue-500 text-white py-2 rounded font-medium active:bg-blue-600">导入 TXT</button>
            </div>
            <input type="file" ref="txtInput" class="hidden" accept=".txt" @change="handleTxtFileChange">
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useStickerStore } from '../../stores/stickerStore'
import { useChatStore } from '../../stores/chatStore'

defineEmits(['select-emoji', 'select-sticker'])

const stickerStore = useStickerStore()
const chatStore = useChatStore()

const activeTab = ref('emoji')
const activeScope = ref('global') // 'global' or chatId
const searchQuery = ref('')
const selectedCategory = ref(null)

const fileInput = ref(null)
const txtInput = ref(null)
const showBatchModal = ref(false)
const batchInput = ref('')
const batchCategory = ref('')
const showCategoryMenu = ref(false)
const newCategoryName = ref('')
const isDeleteMode = ref(false)
const selectedStickers = ref([])
const showConfirmModal = ref(false)
const confirmMessage = ref('')
const confirmCallback = ref(null)

// Single upload modal state (custom name + category + short URL upload)
const showUploadModal = ref(false)
const pendingFile = ref(null)
const pendingFilePreview = ref('')
const customStickerName = ref('')
const uploadCategory = ref('')
const showUploadCategoryMenu = ref(false)
const newUploadCategoryName = ref('')
const isUploading = ref(false)
const isOcrLoading = ref(false)
const useTagAsPrefix = ref(false)

const defaultStickerName = computed(() => {
    if (!pendingFile.value) return ''
    const n = pendingFile.value.name || ''
    return n.split('.').slice(0, -1).join('.') || n || '自定义表情'
})

const displayedStickers = computed(() => {
    const char = chatStore.currentChat
    return stickerStore.getStickers(activeScope.value, char?.emojis || [])
})

// Available categories from current stickers
const availableCategories = computed(() => {
    const categories = new Set()
    displayedStickers.value.forEach(s => {
        if (s.category) categories.add(s.category)
    })
    return Array.from(categories).sort()
})

// Filtered stickers based on search and category
const filteredStickers = computed(() => {
    let result = displayedStickers.value

    // Filter by category
    if (selectedCategory.value) {
        result = result.filter(s => s.category === selectedCategory.value)
    }

    // Filter by search query
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter(s =>
            s.name?.toLowerCase().includes(query) ||
            s.category?.toLowerCase().includes(query)
        )
    }

    return result
})

const getDisplayName = (name) => {
    if (!name) return ''
    // Strip emojis, Asian punctuation, and standard symbols for a cleaner UI look
    return name
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/[。.，,！!？?：:\-\s\(\)（）]/g, '')
        .trim() || name
}

// Standard Emoji List (Subset)
const simpleEmojiList = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '​​​​​​😨', '😩', '🤯', '😬', '​​​​​​😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🤡', '🥳', '🥴', '🥺', '🤥', '🤫', '🤭', '🧐', '🤓'
];

const triggerUpload = () => {
    fileInput.value.click()
}

const deletingUrl = ref(null)
const toastMessage = ref('')
const toastTimer = ref(null)
// [BUG FIX] 保存删除确认重置定时器 ID, 卸载时清理
const deleteResetTimer = ref(null)

const showToast = (msg) => {
    toastMessage.value = msg
    clearTimeout(toastTimer.value)
    toastTimer.value = setTimeout(() => {
        toastMessage.value = ''
    }, 2000)
}

const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) {
        event.target.value = ''
        return
    }

    // 多个文件 → 批量 OCR 弹窗
    if (files.length > 1) {
        startBatchOcrMode(files)
        event.target.value = ''
        return
    }

    // 单个文件 → 现有单文件弹窗
    const file = files[0]
    if (file) {
        // Reset modal state
        pendingFile.value = file
        customStickerName.value = ''
        uploadCategory.value = ''
        newUploadCategoryName.value = ''
        showUploadCategoryMenu.value = false
        isUploading.value = false
        useTagAsPrefix.value = false

        // Generate preview
        try {
            pendingFilePreview.value = URL.createObjectURL(file)
        } catch (e) {
            pendingFilePreview.value = ''
        }

        showUploadModal.value = true
    }
    event.target.value = ''
}

// OCR: 本地 Tesseract.js 识别, 不消耗 API
const autoRecognizeName = async () => {
    if (isOcrLoading.value || !pendingFile.value) return
    isOcrLoading.value = true
    try {
        const { compressImage } = await import('../../utils/imageUtils')
        const base64 = await compressImage(pendingFile.value, { maxWidth: 800, maxHeight: 800, quality: 0.85 })
        const { recognizeImageText } = await import('../../utils/aiService')
        const text = await recognizeImageText(base64)
        if (text) {
            customStickerName.value = text
            showToast(`本地识别: ${text}`)
        } else {
            showToast('未识别到文字 (本地 OCR)')
        }
    } catch (e) {
        console.error('[OCR] failed', e)
        showToast('本地识别失败: ' + (e.message || '未知错误'))
    } finally {
        isOcrLoading.value = false
    }
}

// ============ 批量 OCR 上传 ============
// 多选文件后进入此模式: 列表展示, 逐个 OCR, 可编辑名字, 批量上传
const showBatchOcrModal = ref(false)
const batchOcrItems = ref([])  // [{ file, preview, name, status: 'pending'|'ocr-ing'|'ocr-done'|'ocr-fail'|'uploading'|'done'|'fail' }]
const batchOcrCategory = ref('')
const batchOcrUsePrefix = ref(false)
const isBatchOcrRunning = ref(false)  // 一键识别进行中
const isBatchUploading = ref(false)

const startBatchOcrMode = (files) => {
    batchOcrItems.value = files.map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        name: '',
        status: 'pending',
    }))
    batchOcrCategory.value = ''
    batchOcrUsePrefix.value = false
    showBatchOcrModal.value = true
}

// 单个文件 OCR (按 index)
const ocrSingleItem = async (idx) => {
    const item = batchOcrItems.value[idx]
    if (!item || item.status === 'ocr-ing' || item.status === 'done') return
    item.status = 'ocr-ing'
    try {
        const { compressImage } = await import('../../utils/imageUtils')
        const base64 = await compressImage(item.file, { maxWidth: 800, maxHeight: 800, quality: 0.85 })
        const { recognizeImageText } = await import('../../utils/aiService')
        const text = await recognizeImageText(base64)
        if (text) {
            item.name = text
            item.status = 'ocr-done'
        } else {
            item.status = 'ocr-fail'
        }
    } catch (e) {
        console.error('[BatchOCR] item', idx, e)
        item.status = 'ocr-fail'
    }
}

// 一键识别所有 pending 项 (顺序执行, 避免 API 限流)
const ocrAllItems = async () => {
    if (isBatchOcrRunning.value) return
    isBatchOcrRunning.value = true
    try {
        for (let i = 0; i < batchOcrItems.value.length; i++) {
            const item = batchOcrItems.value[i]
            if (item.status === 'pending' || item.status === 'ocr-fail') {
                await ocrSingleItem(i)
            }
        }
        showToast('批量识别完成')
    } finally {
        isBatchOcrRunning.value = false
    }
}

// 批量上传
const batchUploadAll = async () => {
    if (isBatchUploading.value) return
    isBatchUploading.value = true
    let successCount = 0
    let failCount = 0
    try {
        for (let i = 0; i < batchOcrItems.value.length; i++) {
            const item = batchOcrItems.value[i]
            if (item.status === 'done' || item.status === 'uploading') continue
            item.status = 'uploading'
            try {
                let name = item.name.trim()
                if (!name) {
                    // 无名字用文件名
                    const fn = item.file.name || ''
                    name = fn.split('.').slice(0, -1).join('.') || fn || `Custom_${Date.now()}`
                }
                // 标签前缀
                if (batchOcrUsePrefix.value && batchOcrCategory.value) {
                    name = `${batchOcrCategory.value}-${name}`
                }
                await stickerStore.uploadSticker(
                    item.file,
                    activeScope.value,
                    name,
                    batchOcrCategory.value.trim()
                )
                item.status = 'done'
                successCount++
            } catch (e) {
                console.error('[BatchUpload] item', i, e)
                item.status = 'fail'
                failCount++
            }
        }
        showToast(`上传完成: 成功 ${successCount}${failCount ? `, 失败 ${failCount}` : ''}`)
        if (failCount === 0) {
            _closeBatchOcrModal()
        }
    } finally {
        isBatchUploading.value = false
    }
}

const _closeBatchOcrModal = () => {
    // 释放预览 URL
    batchOcrItems.value.forEach(item => {
        if (item.preview) {
            try { URL.revokeObjectURL(item.preview) } catch (e) {}
        }
    })
    showBatchOcrModal.value = false
    batchOcrItems.value = []
}

// 批量列表里删除某项 (还没上传的才能删)
const removeBatchItem = (idx) => {
    const item = batchOcrItems.value[idx]
    if (item?.preview) {
        try { URL.revokeObjectURL(item.preview) } catch (e) {}
    }
    batchOcrItems.value.splice(idx, 1)
    if (batchOcrItems.value.length === 0) {
        _closeBatchOcrModal()
    }
}

// 新建分类标签 (单个上传弹窗内)
const addNewUploadCategory = () => {
    if (newUploadCategoryName.value.trim()) {
        uploadCategory.value = newUploadCategoryName.value.trim()
        newUploadCategoryName.value = ''
        showUploadCategoryMenu.value = false
    }
}

const cancelUpload = () => {
    if (isUploading.value) return
    _resetUploadModal()
}

const _resetUploadModal = () => {
    if (pendingFilePreview.value) {
        try { URL.revokeObjectURL(pendingFilePreview.value) } catch (e) {}
    }
    showUploadModal.value = false
    pendingFile.value = null
    pendingFilePreview.value = ''
    customStickerName.value = ''
    uploadCategory.value = ''
    newUploadCategoryName.value = ''
    showUploadCategoryMenu.value = false
    isUploading.value = false
    isOcrLoading.value = false
    useTagAsPrefix.value = false
}

const confirmUpload = async () => {
    if (!pendingFile.value || isUploading.value) return
    isUploading.value = true
    try {
        let name = customStickerName.value.trim()
        const category = uploadCategory.value.trim()
        // 标签作为前缀: "搞怪" + "嘬嘬" → "搞怪-嘬嘬"
        if (useTagAsPrefix.value && category) {
            const baseName = name || defaultStickerName.value
            name = `${category}-${baseName}`
        }
        const result = await stickerStore.uploadSticker(
            pendingFile.value,
            activeScope.value,
            name,
            category
        )
        // 图床国内不可用, 不再区分短链/本地存储提示
        showToast('添加成功')
        _resetUploadModal()
    } catch (e) {
        console.error(e)
        showToast('添加失败')
        isUploading.value = false
    }
}

const triggerTxtImport = () => {
    txtInput.value.click()
}

// 新建分类标签
const addNewCategory = () => {
    if (newCategoryName.value.trim()) {
        batchCategory.value = newCategoryName.value.trim()
        newCategoryName.value = ''
        showCategoryMenu.value = false
    }
}

const handleTxtFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
        const content = e.target.result
        const res = stickerStore.importStickersFromText(content, activeScope.value, batchCategory.value)

        if (activeScope.value !== 'global' && res.newStickers?.length > 0) {
            const char = chatStore.currentChat
            if (char) {
                const newEmojis = [...(char.emojis || []), ...res.newStickers]
                chatStore.updateCharacter(char.id, { emojis: newEmojis })
            }
        }

        showToast(`成功:${res.success}, 重复:${res.duplicate}, 失败:${res.failed}`)
        showBatchModal.value = false
        event.target.value = ''
    }
    reader.onerror = () => showToast('读取文件失败')
    reader.readAsText(file)
}

// 切换删除模式
const toggleDeleteMode = () => {
    isDeleteMode.value = !isDeleteMode.value
    selectedStickers.value = []
}

// 切换表情包选择
const toggleStickerSelection = (sticker) => {
    const url = sticker.url
    const index = selectedStickers.value.indexOf(url)
    if (index > -1) {
        selectedStickers.value.splice(index, 1)
    } else {
        selectedStickers.value.push(url)
    }
}

// 处理确认操作
const handleConfirmAction = () => {
    if (confirmCallback.value) {
        confirmCallback.value()
        showConfirmModal.value = false
        confirmCallback.value = null
    }
}

// 清空全部
const clearAllStickers = () => {
    confirmMessage.value = '确定要清空所有表情包吗？'
    confirmCallback.value = () => {
        stickerStore.clearAllStickers(activeScope.value)
        showToast('已清空所有表情包')
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

// 清空分类
const clearCategory = () => {
    if (!selectedCategory.value) return
    
    const categoryStickers = displayedStickers.value.filter(s => s.category === selectedCategory.value)
    confirmMessage.value = `确定要清空"${selectedCategory.value}"分类的所有表情包吗？`
    confirmCallback.value = () => {
        categoryStickers.forEach(sticker => {
            stickerStore.deleteSticker(sticker.url, activeScope.value)
        })
        
        showToast(`已清空 ${categoryStickers.length} 个表情包`)
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

// 批量删除选中表情包
const deleteSelectedStickers = () => {
    if (selectedStickers.value.length === 0) return
    
    confirmMessage.value = `确定要删除选中的 ${selectedStickers.value.length} 个表情包吗？`
    confirmCallback.value = () => {
        stickerStore.deleteBatchStickers([...selectedStickers.value], activeScope.value)
        
        showToast(`已删除 ${selectedStickers.value.length} 个表情包`)
        selectedStickers.value = []
        isDeleteMode.value = false
    }
    showConfirmModal.value = true
}

const deleteSticker = (url) => {
    if (deletingUrl.value === url) {
        stickerStore.deleteSticker(url, activeScope.value)
        deletingUrl.value = null
        showToast('删除成功')
    } else {
        deletingUrl.value = url
        // Auto reset confirmation after 3s
        // [BUG FIX] 保存定时器 ID, 卸载时清理
        deleteResetTimer.value = setTimeout(() => {
            deleteResetTimer.value = null
            if (deletingUrl.value === url) deletingUrl.value = null
        }, 3000)
    }
}

const handleBatchImport = () => {
    if (!batchInput.value.trim()) return
    const res = stickerStore.importStickersFromText(batchInput.value, activeScope.value, batchCategory.value)

    if (activeScope.value !== 'global' && res.newStickers?.length > 0) {
        const char = chatStore.currentChat
        if (char) {
            const newEmojis = [...(char.emojis || []), ...res.newStickers]
            chatStore.updateCharacter(char.id, { emojis: newEmojis })
        }
    }

    showToast(`导入完成: 成功${res.success}, 重复${res.duplicate}, 失败${res.failed}`)
    batchInput.value = ''
    batchCategory.value = ''
    showBatchModal.value = false
}

// [BUG FIX] 清理 toast + 删除确认重置定时器, 防止卸载后回调在已卸载组件上执行
onUnmounted(() => {
    if (toastTimer.value) { clearTimeout(toastTimer.value); toastTimer.value = null }
    if (deleteResetTimer.value) { clearTimeout(deleteResetTimer.value); deleteResetTimer.value = null }
    // 清理待上传预览的 Object URL
    if (pendingFilePreview.value) {
        try { URL.revokeObjectURL(pendingFilePreview.value) } catch (e) {}
        pendingFilePreview.value = ''
    }
})
</script>

<style scoped>
.emoji-picker {
    user-select: none;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d1d1;
    border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.animate-slide-up {
    animation: slideUp 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>
