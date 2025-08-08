// Rush Lounge 経営管理システム JavaScript

class RushLoungeManager {
    constructor() {
        // Firebase設定
        this.firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "rush-rounge-data.firebaseapp.com",
            databaseURL: "https://rush-rounge-data-default-rtdb.firebaseio.com",
            projectId: "rush-rounge-data",
            storageBucket: "rush-rounge-data.appspot.com",
            messagingSenderId: "YOUR_SENDER_ID",
            appId: "YOUR_APP_ID"
        };
        
        // 共有機能関連
        this.isOnline = false;
        this.storeCode = 'Rush Lounge'; // 固定店舗コード
        this.onlineUsers = 1;
        this.firebaseApp = null;
        this.database = null;
        this.listeners = {};
        
        // リアルタイム保存用
        this.saveTimeout = null;
        
        this.data = {
            attendance: [],
            dailyMenu: [],
            dailyMenuConfigs: [], // 日替わりメニュー設定
            regularMenu: [],
            otherRevenue: [],
            expenses: [],
            vaultTransactions: [],
            courses: [],
            products: [], // 新規商品
            pendingSavings: 0, // 貯金予定額
            employees: [] // 従業員管理
        };
        
        // 固定価格設定
        this.fixedPrices = {
            dailyMenu: 25000,
            simple: 30000,
            chill: 40000,
            special: 50000
        };
        
        // ボーナス設定（1日300,000円）
        this.bonusPerDay = 300000;
        
        // カレンダー関連の変数
        this.currentCalendarDate = new Date();
        this.selectedDate = null;
        this.currentWeekStart = new Date();
        
        // 素材マスターデータ
        this.materials = {
            'パイナップル': 5000,
            'イチゴ': 5000,
            'ブルーベリー': 5000,
            'トマト': 5000,
            'トウモロコシ': 5000,
            'なすび': 5000,
            'ジャガイモ': 5000,
            'カボチャ': 5000,
            '白ワイン': 50000,
            'ロゼワイン': 50000,
            'ウイスキー': 10000,
            'ラム酒': 2400
        };
        
        this.init();
        this.initializeDefaultData();
    }

    // 日替わりメニューの現在価格を取得
    getDailyMenuPrice() {
        // 「日替わりメニュー」という名前のコースを検索
        const dailyMenuCourse = this.data.courses.find(course => 
            course.name === '日替わりメニュー' || course.name.includes('日替わり')
        );
        
        if (dailyMenuCourse) {
            console.log(`📊 日替わりメニュー価格をコースから取得: ¥${dailyMenuCourse.price.toLocaleString()}`);
            return dailyMenuCourse.price;
        }
        
        // デフォルト価格（従来の固定価格）
        console.log('📊 日替わりメニューコースが見つからないため、デフォルト価格を使用: ¥25,000');
        return 25000;
    }

    // 日替わりメニューの価格表示を更新
    updateDailyMenuPriceDisplay() {
        const currentPrice = this.getDailyMenuPrice();
        const priceInput = document.getElementById('config-price');
        const priceInfo = document.getElementById('daily-menu-price-info');
        
        if (priceInput) {
            priceInput.value = currentPrice;
        }
        
        if (priceInfo) {
            const dailyMenuCourse = this.data.courses.find(course => 
                course.name === '日替わりメニュー' || course.name.includes('日替わり')
            );
            
            if (dailyMenuCourse) {
                priceInfo.textContent = `※ コース管理「${dailyMenuCourse.name}」の価格 ¥${currentPrice.toLocaleString()} が適用されます`;
            } else {
                priceInfo.textContent = '※ デフォルト価格 ¥25,000 が適用されます（コース管理で「日替わりメニュー」を作成すると価格を変更できます）';
            }
        }
        
        console.log(`💰 日替わりメニュー価格表示を更新: ¥${currentPrice.toLocaleString()}`);
    }

    // 初期化
    init() {
        this.loadData();
        this.setupEventListeners();
        this.setupTabs();
        this.setupSubTabs();
        this.setCurrentDate();
        this.setupMaterialSelector();
        this.initializeMenuTypeSelector();
        this.initializeDailyMenuProductSelector();
        this.initializeCourseProductSelector();
        this.initializeFirebase();
        this.setupStoreConnection();
        this.setupGistSync();
        
        // フォーム保護の初期設定
        setTimeout(() => {
            this.setupFormProtection();
        }, 1000);
        
        // データインポートリスナーを複数回設定（確実に実行）
        this.setupDataImportListeners();
        setTimeout(() => {
            this.setupDataImportListeners();
        }, 100);
        setTimeout(() => {
            this.setupDataImportListeners();
        }, 500);
        setTimeout(() => {
            this.setupDataImportListeners();
        }, 1000);
        
        this.updateAllDisplays();
        console.log('Rush Lounge管理システムが初期化されました');
    }

    // 初期データの登録
    initializeDefaultData() {
        // データの更新フラグ（移動販売価格統一・素材情報・詳細説明追加のため）
        const needsUpdate = this.data.products.length > 0 && 
            (!this.data.products[0].materials || 
             (this.data.products[0].name === 'Tropic Whisper' && !this.data.products[0].description.includes('🍍')) ||
             (this.data.products.find(p => p.name === 'Tropic Whisper' && p.price !== 10000)));
        
        // 従業員の初期データを設定（空の場合のみ）
        if (this.data.employees.length === 0) {
            this.data.employees = [
                { 
                    id: 1, 
                    name: 'アレスト　ファーマー', 
                    joinDate: '2025-04-22', 
                    active: true,
                    timestamp: new Date().toISOString()
                },
                { 
                    id: 2, 
                    name: '矢神　ペス', 
                    joinDate: '2025-04-22', 
                    active: true,
                    timestamp: new Date().toISOString()
                }
            ];
            this.saveData(); // 従業員データを保存
        } else {
            // 既存データがある場合は入社日のみ更新
            let updated = false;
            this.data.employees.forEach(employee => {
                if ((employee.name === 'アレスト　ファーマー' || employee.name === '矢神　ペス') && 
                    employee.joinDate !== '2025-04-22') {
                    employee.joinDate = '2025-04-22';
                    employee.timestamp = new Date().toISOString();
                    updated = true;
                }
            });
            if (updated) {
                this.saveData();
            }
        }
        
        // 既存データがある場合で更新不要の場合はスキップ
        if (this.data.courses.length > 0 && this.data.products.length > 0 && !needsUpdate) {
            return;
        }

        // 既存コースの登録（実際の商品コストに基づいて算出）
        const defaultCourses = [
            {
                id: 1001,
                name: '日替わりメニュー',
                price: 25000,
                cost: 15900, // 平均的なコスト（カクテル2品 + 料理1品）
                description: 'カクテル2品 + 料理1品の日替わりセット',
                ingredients: '季節の食材を使用\nプレミアムアルコール\n※構成により原価変動'
            },
            {
                id: 1002,
                name: 'Simple Menu',
                price: 30000,
                cost: 15900, // Tropic Whisper(9200) + Night Vegigratin(4200) + Noir Berry(2500)
                description: 'Tropic Whisper + Night Vegigratin + Noir Berry',
                ingredients: 'パイナップル、白ワイン\n野菜5種\nブルーベリー、ウイスキー'
            },
            {
                id: 1003,
                name: 'Chill Menu',
                price: 40000,
                cost: 15900, // Noir Berry(2500) + Night Vegigratin(4200) + Scarlet Kiss(9200)
                description: 'Noir Berry + Night Vegigratin + Scarlet Kiss',
                ingredients: 'ブルーベリー、ウイスキー\n野菜5種\nイチゴ、ロゼワイン'
            },
            {
                id: 1004,
                name: 'Special Menu',
                price: 50000,
                cost: 14650, // Rouge Oriental(1250) + Five Colours Plate(4200) + Tropic Whisper(9200)
                description: 'Rouge Oriental + Five Colours Plate + Tropic Whisper',
                ingredients: 'トマト、ラム酒\n野菜5種\nパイナップル、白ワイン'
            }
        ];

        // 既存商品の登録（移動販売価格¥10,000統一）
        const defaultProducts = [
            // カクテル
            {
                id: 2001,
                name: 'Tropic Whisper',
                category: 'cocktail',
                price: 10000, // 移動販売固定価格
                cost: 9200, // パイナップル(5000) + 白ワイン(50000) = 55000 ÷ 6個 = 9167円
                description: '🍍 トロピック・ウィスパー…フルーツの華やかさ+花の香りで軽やかに',
                materials: 'パイナップル*1(¥5,000)、白ワイン*1(¥50,000)',
                craftYield: 6,
                totalMaterialCost: 55000
            },
            {
                id: 2002,
                name: 'Scarlet Kiss',
                category: 'cocktail',
                price: 10000, // 移動販売固定価格
                cost: 9200, // イチゴ(5000) + ロゼワイン(50000) = 55000 ÷ 6個 = 9167円
                description: '🍓 スカーレット・キス…軽やかな泡とともに香る、甘く切ないキスのような一杯',
                materials: 'イチゴ*1(¥5,000)、ロゼワイン*1(¥50,000)',
                craftYield: 6,
                totalMaterialCost: 55000
            },
            {
                id: 2003,
                name: 'Noir Berry',
                category: 'cocktail',
                price: 10000, // 移動販売固定価格
                cost: 2500, // ブルーベリー(5000) + ウイスキー(10000) = 15000 ÷ 6個 = 2500円
                description: '🫐 ノワール・ベリー…ダークな果実感とスモークの重なり。意外性で魅せる一杯',
                materials: 'ブルーベリー*1(¥5,000)、ウイスキー*1(¥10,000)',
                craftYield: 6,
                totalMaterialCost: 15000
            },
            {
                id: 2004,
                name: 'Rouge Oriental',
                category: 'cocktail',
                price: 10000, // 移動販売固定価格
                cost: 1250, // トマト(5000) + ラム酒(2400) = 7400 ÷ 6個 = 1233円
                description: '🍅 ルージュ・オリエンタル…トマトにオリエンタルスパイスを加えた、幻想的な風味',
                materials: 'トマト*1(¥5,000)、ラム酒*1(¥2,400)',
                craftYield: 6,
                totalMaterialCost: 7400
            },
            // 料理
            {
                id: 3001,
                name: 'Night Vegigratin',
                category: 'dish',
                price: 10000, // 移動販売固定価格
                cost: 4200, // 野菜5種(5000*5) = 25000 ÷ 6個 = 4167円
                description: 'ナイト・ベジグラタン…「小さくて、あつあつで、うまい」寒い夜にぴったり。グラス片手に食べられる、ミニサイズの満足感。',
                materials: 'トマト*1(¥5,000)、トウモロコシ*1(¥5,000)、なすび*1(¥5,000)、ジャガイモ*1(¥5,000)、カボチャ*1(¥5,000)',
                craftYield: 6,
                totalMaterialCost: 25000
            },
            {
                id: 3002,
                name: 'Five Colours Plate',
                category: 'dish',
                price: 10000, // 移動販売固定価格
                cost: 4200, // 野菜5種(5000*5) = 25000 ÷ 6個 = 4167円
                description: 'ファイブ・カラーズ・プレート…「今日は全部野菜なのに、ワインが止まらない」グラスを片手に、味も食感も違う5種の"ベジつま"を楽しめる、色とりどりの前菜プレート。',
                materials: 'トマト*1(¥5,000)、トウモロコシ*1(¥5,000)、なすび*1(¥5,000)、ジャガイモ*1(¥5,000)、カボチャ*1(¥5,000)',
                craftYield: 6,
                totalMaterialCost: 25000
            }
        ];

        // 素材の初期データを設定（空の場合のみ）
        if (Object.keys(this.data.materialHistory).length === 0) {
            this.data.materialHistory = {
                'パイナップル': 5000,
                '白ワイン': 50000,
                'トマト': 3000,
                'チーズ': 8000
            };
            console.log('素材の初期データを設定しました');
        }

        // 日替わりメニューコースを追加（存在しない場合のみ）
        const hasDailyMenuCourse = this.data.courses.some(course => 
            course.name === '日替わりメニュー' || course.name.includes('日替わり')
        );
        
        if (!hasDailyMenuCourse) {
            const dailyMenuCourse = {
                id: Date.now() + Math.random(),
                name: '日替わりメニュー',
                price: 25000,
                cost: 12500,
                description: 'その日に設定された3品の組み合わせメニュー',
                ingredients: 'その日の設定による',
                products: ['daily-menu'], // 特別な識別子
                selectedProducts: [],
                timestamp: new Date().toISOString()
            };
            this.data.courses.push(dailyMenuCourse);
            console.log('📋 日替わりメニューコースを追加しました');
        }

        // データが空の場合または更新が必要な場合に追加/更新
        if (this.data.courses.filter(c => c.name !== '日替わりメニュー').length === 0) {
            // 既存の日替わりメニュー以外のコースがない場合のみデフォルトコースを追加
            this.data.courses = [...this.data.courses.filter(c => c.name === '日替わりメニュー'), ...defaultCourses];
        } else if (needsUpdate) {
            // 既存コースの原価を更新
            this.data.courses.forEach(course => {
                const defaultCourse = defaultCourses.find(dc => dc.name === course.name);
                if (defaultCourse) {
                    course.cost = defaultCourse.cost;
                    course.ingredients = defaultCourse.ingredients;
                }
            });
        }

        if (this.data.products.length === 0) {
            this.data.products = defaultProducts;
        } else if (needsUpdate) {
            // 既存商品に移動販売価格統一・素材情報・詳細説明を追加
            this.data.products.forEach(product => {
                const defaultProduct = defaultProducts.find(dp => dp.name === product.name);
                if (defaultProduct) {
                    product.price = 10000; // 移動販売価格を統一
                    product.cost = defaultProduct.cost;
                    product.description = defaultProduct.description;
                    product.materials = defaultProduct.materials;
                    product.craftYield = defaultProduct.craftYield;
                    product.totalMaterialCost = defaultProduct.totalMaterialCost;
                } else {
                    // 新規追加商品も移動販売価格を統一
                    product.price = 10000;
                }
            });
        }

        // データを保存
        this.saveData();
        
        if (needsUpdate) {
            console.log('商品データに移動販売価格統一・素材情報・詳細説明を追加し、原価を更新しました');
        } else {
            console.log('初期データが登録されました');
        }
        
        // 表示を更新
        this.updateCourseDisplay();
        this.updateProductDisplay();
        this.updateCourseManagementDisplay();
        this.updateProductManagementDisplay();
    }

    // データの読み込み
    loadData() {
        const savedData = localStorage.getItem('rushLoungeData');
        if (savedData) {
            this.data = { ...this.data, ...JSON.parse(savedData) };
        }
    }

    // データの保存
    saveData() {
        localStorage.setItem('rushLoungeData', JSON.stringify(this.data));
    }

    // 現在日時の設定（日本標準時）
    setCurrentDate() {
        const now = new Date();
        // 日本標準時（UTC+9）に変換
        const jstOffset = 9 * 60; // 9時間をミニッツで
        const jstTime = new Date(now.getTime() + (jstOffset * 60 * 1000));
        
        const currentDate = jstTime.toISOString().split('T')[0];
        const currentDateTime = jstTime.toISOString().slice(0, 16);
        
        // 各フォームの日付フィールドに現在日時を設定
        const dateFields = [
            'attendance-date', 'config-date', 'daily-date', 'regular-date', 'revenue-date',
            'expense-date', 'vault-date', 'week-start', 'summary-start-date', 'summary-end-date'
        ];
        
        dateFields.forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                if (id === 'attendance-date') {
                    field.value = currentDateTime;
                } else {
                    field.value = currentDate;
                }
            }
        });
    }

    // タブ機能の設定
    setupTabs() {
        const tabButtons = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // アクティブなタブとコンテンツを更新
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                // タブが変更されたときに表示を更新
                this.updateTabDisplay(targetTab);
            });
        });
    }

    // 各種イベントリスナーの設定
    setupEventListeners() {
        // フォーム送信イベント（attendance-formは削除済みのためコメントアウト）
        // document.getElementById('attendance-form').addEventListener('submit', (e) => this.handleAttendance(e));
        document.getElementById('daily-menu-config-form').addEventListener('submit', (e) => this.handleDailyMenuConfig(e));
        document.getElementById('daily-menu-form').addEventListener('submit', (e) => this.handleDailyMenu(e));
        document.getElementById('regular-menu-form').addEventListener('submit', (e) => this.handleRegularMenu(e));
        document.getElementById('other-revenue-form').addEventListener('submit', (e) => this.handleOtherRevenue(e));
        document.getElementById('expense-form').addEventListener('submit', (e) => this.handleExpense(e));
        document.getElementById('vault-form').addEventListener('submit', (e) => this.handleVault(e));
        document.getElementById('course-form').addEventListener('submit', (e) => this.handleCourse(e));
        document.getElementById('product-form').addEventListener('submit', (e) => this.handleProduct(e));
        document.getElementById('material-form').addEventListener('submit', (e) => this.handleMaterial(e));
        document.getElementById('employee-form').addEventListener('submit', (e) => this.handleAddEmployee(e));

        // ボタンイベント
        document.getElementById('filter-sales').addEventListener('click', () => this.filterSales());
        document.getElementById('reset-filter').addEventListener('click', () => this.resetFilter());
        // document.getElementById('calculate-weekly').addEventListener('click', () => this.calculateWeeklyStats()); // 削除済み
        
        // データインポートイベント
        this.setupDataImportListeners();
        
        // リアルタイム保存の設定
        this.setupRealTimeSave();
        
        // コース作成商品選択の初期化
        this.initializeCourseProductSelector();
        
        // カレンダー機能の初期化
        this.initializeAttendanceCalendar();
        this.initializeWeeklyCalendar();
    }

    // サブタブ機能の設定
    setupSubTabs() {
        const subTabButtons = document.querySelectorAll('.sub-nav-tab');
        const subTabContents = document.querySelectorAll('.sub-tab-content');

        subTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetSubTab = button.dataset.subtab;
                
                // アクティブなサブタブとコンテンツを更新
                subTabButtons.forEach(btn => btn.classList.remove('active'));
                subTabContents.forEach(content => content.classList.remove('active'));
                
                button.classList.add('active');
                document.getElementById(targetSubTab).classList.add('active');
                
                // サブタブが変更されたときに表示を更新
                this.updateSubTabDisplay(targetSubTab);
            });
        });
    }

    // コース作成商品選択の初期化
    initializeCourseProductSelector() {
        const selectors = ['course-product-1', 'course-product-2', 'course-product-3'];
        
        selectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                // optgroup構造を保持して商品選択肢を更新
                selector.innerHTML = `
                    <option value="">商品を選択してください</option>
                    <optgroup label="登録商品">
                        ${this.data.products.map(product => 
                            `<option value="${product.id}">${product.name} (¥${product.cost.toLocaleString()})</option>`
                        ).join('')}
                    </optgroup>
                    <optgroup label="日替わりメニュー">
                        <option value="daily-menu">日替わりメニュー（設定日の商品構成）</option>
                    </optgroup>
                `;
            }
        });
    }

    // コース計算の更新
    updateCourseCalculation() {
        const product1Id = document.getElementById('course-product-1').value;
        const product2Id = document.getElementById('course-product-2').value;
        const product3Id = document.getElementById('course-product-3').value;
        const coursePrice = parseInt(document.getElementById('course-price').value) || 0;

        // 選択された商品を取得（日替わりメニュー対応）
        const selectedProducts = [];
        const selectedProductNames = [];
        let totalCost = 0;
        
        [product1Id, product2Id, product3Id].forEach(id => {
            if (id === 'daily-menu') {
                // 日替わりメニューが選択された場合
                selectedProductNames.push('日替わりメニュー');
                totalCost += 12500; // 日替わりメニューの想定原価（25000円の半分）
            } else if (id) {
                const product = this.data.products.find(p => p.id == id);
                if (product) {
                    selectedProducts.push(product);
                    selectedProductNames.push(product.name);
                    totalCost += product.cost;
                }
            }
        });

        // 選択商品の表示
        const selectedProductsDisplay = document.getElementById('selected-course-products');
        if (selectedProductNames.length === 0) {
            selectedProductsDisplay.textContent = 'なし';
        } else {
            selectedProductsDisplay.textContent = selectedProductNames.join(', ');
        }

        // 原価計算
        document.getElementById('calculated-course-cost').textContent = `¥${totalCost.toLocaleString()}`;
        document.getElementById('course-cost').value = totalCost;

        // 利益計算
        const profit = coursePrice - totalCost;
        const profitDisplay = document.getElementById('estimated-course-profit');
        profitDisplay.textContent = `¥${profit.toLocaleString()}`;

        // コース内容の自動生成
        const descriptions = [];
        selectedProducts.forEach(p => descriptions.push(`${p.name}: ${p.description}`));
        if (selectedProductNames.includes('日替わりメニュー')) {
            descriptions.push('日替わりメニュー: その日設定されたメニュー構成');
        }
        
        if (descriptions.length > 0) {
            document.getElementById('course-description').value = descriptions.join('\n');
        } else {
            document.getElementById('course-description').value = '';
        }

        // 使用食材の自動生成
        if (selectedProducts.length > 0) {
            const materialsSet = new Set();
            selectedProducts.forEach(product => {
                if (product.materials) {
                    // 商品の食材情報を追加
                    materialsSet.add(`${product.name}の素材: ${product.materials}`);
                }
            });
            
            if (materialsSet.size > 0) {
                document.getElementById('course-ingredients').value = Array.from(materialsSet).join('\n');
            } else {
                document.getElementById('course-ingredients').value = '素材情報未設定';
            }
        } else {
            document.getElementById('course-ingredients').value = '';
        }
    }

    // メニュータイプ選択肢の初期化
    initializeMenuTypeSelector() {
        this.updateMenuTypeSelector();
    }

    // 日替わりメニュー商品選択肢の初期化
    initializeDailyMenuProductSelector() {
        this.updateDailyMenuProductSelector();
    }

    // 日替わりメニュー商品選択肢の更新
    updateDailyMenuProductSelector() {
        const selectors = [
            { id: 'daily-item-1', category: 'cocktail', label: 'カクテル' },
            { id: 'daily-item-2', category: 'dish', label: '料理' },
            { id: 'daily-item-3', category: 'cocktail', label: 'カクテル' }
        ];

        const products = this.data.products || [];

        selectors.forEach(selectorInfo => {
            const selector = document.getElementById(selectorInfo.id);
            if (!selector) return;

            // カテゴリ別の商品を取得
            const categoryProducts = products.filter(p => p.category === selectorInfo.category);

            // 選択肢のHTML生成
            let html = `<option value="">${selectorInfo.label}を選択してください</option>`;
            
            if (categoryProducts.length > 0) {
                categoryProducts.forEach(product => {
                    html += `<option value="${product.name}">${product.name}</option>`;
                });
            } else {
                html += `<option value="" disabled>登録された${selectorInfo.label}がありません</option>`;
            }

            selector.innerHTML = html;
        });

        console.log(`📋 日替わりメニュー商品選択肢を更新: 商品 ${products.length}個`);
    }

    // メニュータイプ選択肢の更新（登録コースのみ、日替わりメニュー除外）
    updateMenuTypeSelector() {
        const selector = document.getElementById('menu-type');
        if (!selector) return;

        // 登録済みコースを取得（日替わりメニューを除外）
        const registeredCourses = (this.data.courses || []).filter(course => {
            // 日替わりメニューを除外する条件
            return course.name !== '日替わりメニュー' && 
                   course.price !== 25000 && // 日替わりメニューの固定価格
                   !course.isDailyMenu; // 日替わりメニューフラグがある場合
        });

        // 選択肢のHTML生成
        let html = '<option value="">メニュータイプを選択してください</option>';
        
        // 登録済みコース（日替わりメニュー除外）のみを追加
        if (registeredCourses.length > 0) {
            registeredCourses.forEach(course => {
                html += `<option value="course-${course.id}">${course.name} (¥${course.price.toLocaleString()})</option>`;
            });
        } else {
            html += '<option value="" disabled>登録されたコースがありません</option>';
        }

        selector.innerHTML = html;
        console.log(`📋 メニュータイプ選択肢を更新: 登録コース ${registeredCourses.length}個（日替わりメニュー除外）`);
    }

    // メニュータイプ選択時の価格自動設定
    updateMenuPrice(menuType) {
        const priceField = document.getElementById('regular-price');
        
        // 登録済みコースの価格チェック
        if (menuType && menuType.startsWith('course-')) {
            const courseId = parseInt(menuType.replace('course-', ''));
            const course = this.data.courses.find(c => c.id === courseId);
            if (course) {
                priceField.value = course.price;
                return;
            }
        }

        // デフォルト
        priceField.value = '';
    }

    // 出勤記録の処理（従来のフォーム版 - 削除済み）
    // handleAttendance(e) は削除済み（カレンダー直接入力のみ使用）

    // 日替わりメニュー設定の処理
    handleDailyMenuConfig(e) {
        e.preventDefault();
        
        const config = {
            id: Date.now(),
            date: document.getElementById('config-date').value,
            items: [
                document.getElementById('daily-item-1').value,
                document.getElementById('daily-item-2').value,
                document.getElementById('daily-item-3').value
            ],
            price: this.getDailyMenuPrice(), // 動的価格を使用
            timestamp: new Date().toISOString()
        };

        // 同じ日の設定がある場合は削除
        this.data.dailyMenuConfigs = this.data.dailyMenuConfigs.filter(item => item.date !== config.date);
        
        this.data.dailyMenuConfigs.push(config);
        this.saveData();
        this.updateCurrentDailyMenu();
        this.updateDailyMenuConfigDisplay();
        this.showAlert('日替わりメニューが設定されました', 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // 日替わりメニュー売上の処理
    handleDailyMenu(e) {
        e.preventDefault();
        
        const date = document.getElementById('daily-date').value;
        const quantity = parseInt(document.getElementById('daily-quantity').value);
        
        // その日の日替わりメニュー設定を取得
        const menuConfig = this.data.dailyMenuConfigs.find(config => config.date === date);
        
        if (!menuConfig) {
            this.showAlert('選択した日の日替わりメニューが設定されていません。まず日替わりメニューを設定してください。', 'error');
            return;
        }

        // 動的価格を取得（コース管理から）
        const currentPrice = this.getDailyMenuPrice();
        
        const sale = {
            id: Date.now(),
            date: date,
            menuItems: menuConfig.items,
            quantity: quantity,
            price: currentPrice, // 動的価格を使用
            total: quantity * currentPrice, // 動的価格で計算
            type: 'daily',
            timestamp: new Date().toISOString()
        };

        this.data.dailyMenu.push(sale);
        this.saveData();
        this.updateDailyMenuDisplay();
        this.updateSalesStats();
        this.addToPendingSavings(sale.total); // 貯金予定に追加
        this.showAlert('日替わりメニュー売上が記録されました', 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // 通常メニュー売上の処理
    handleRegularMenu(e) {
        e.preventDefault();
        
        const menuType = document.getElementById('menu-type').value;
        const quantity = parseInt(document.getElementById('regular-quantity').value);
        
        if (!menuType) {
            this.showAlert('メニュータイプを選択してください', 'error');
            return;
        }

        let sale = {
            id: Date.now(),
            date: document.getElementById('regular-date').value,
            quantity: quantity,
            type: 'regular',
            timestamp: new Date().toISOString()
        };

        // 登録済みコースの場合
        if (menuType.startsWith('course-')) {
            const courseId = parseInt(menuType.replace('course-', ''));
            const course = this.data.courses.find(c => c.id === courseId);
            
            if (!course) {
                this.showAlert('選択されたコースが見つかりません', 'error');
                return;
            }

            // コースの構成商品から表示用アイテム名を生成
            const menuItems = course.selectedProducts ? 
                course.selectedProducts.map(p => p.name) : 
                course.description ? [course.description] : ['コース構成'];

            sale = {
                ...sale,
                menuType: `course-${courseId}`,
                menuName: course.name,
                menuItems: menuItems,
                price: course.price,
                total: quantity * course.price,
                courseId: courseId // コースIDも保存
            };
        }
        else {
            this.showAlert('無効なメニュータイプです', 'error');
            return;
        }

        this.data.regularMenu.push(sale);
        this.saveData();
        this.updateRegularMenuDisplay();
        this.updateSalesStats();
        this.addToPendingSavings(sale.total); // 貯金予定に追加
        this.showAlert(`${sale.menuName}の売上が記録されました`, 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // その他収益の処理
    handleOtherRevenue(e) {
        e.preventDefault();
        
        const revenue = {
            id: Date.now(),
            date: document.getElementById('revenue-date').value,
            type: document.getElementById('revenue-type').value,
            description: document.getElementById('revenue-description').value || 'なし',
            amount: parseInt(document.getElementById('revenue-amount').value),
            timestamp: new Date().toISOString()
        };

        this.data.otherRevenue.push(revenue);
        this.saveData();
        this.updateOtherRevenueDisplay();
        this.updateSalesStats();
        this.addToPendingSavings(revenue.amount); // 貯金予定に追加
        this.showAlert('その他収益が記録されました', 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // 支出の処理
    handleExpense(e) {
        e.preventDefault();
        
        const expense = {
            id: Date.now(),
            date: document.getElementById('expense-date').value,
            category: document.getElementById('expense-category').value,
            description: document.getElementById('expense-description').value || 'なし',
            amount: parseInt(document.getElementById('expense-amount').value),
            timestamp: new Date().toISOString()
        };

        // 支出記録に追加
        this.data.expenses.push(expense);

        // 金庫から自動出金（スプレッドシート仕様に合わせる）
        const vaultTransaction = {
            id: Date.now() + 1, // 異なるIDを確保
            date: expense.date,
            type: 'withdrawal',
            amount: expense.amount,
            description: `支出: ${this.getExpenseCategoryName(expense.category)} - ${expense.description}`,
            linkedExpenseId: expense.id // 関連する支出記録のID
        };

        this.data.vaultTransactions.push(vaultTransaction);

        this.saveData();
        this.updateExpenseDisplay();
        this.updateVaultDisplay(); // 金庫残高も更新
        this.updateFinancialStats();
        this.showAlert('支出を記録し、金庫から出金しました', 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // 金庫取引の処理
    handleVault(e) {
        e.preventDefault();
        
        const transaction = {
            id: Date.now(),
            date: document.getElementById('vault-date').value,
            type: document.getElementById('transaction-type').value,
            amount: parseInt(document.getElementById('vault-amount').value),
            description: document.getElementById('vault-description').value,
            timestamp: new Date().toISOString()
        };

        this.data.vaultTransactions.push(transaction);
        this.saveData();
        this.updateVaultDisplay();
        this.showAlert('金庫取引が記録されました', 'success');
        e.target.reset();
        this.setCurrentDate();
    }

    // コース登録の処理
    handleCourse(e) {
        e.preventDefault();
        
        const product1Id = document.getElementById('course-product-1').value;
        const product2Id = document.getElementById('course-product-2').value;
        const product3Id = document.getElementById('course-product-3').value;

        // 3品全て選択されているかチェック
        if (!product1Id || !product2Id || !product3Id) {
            this.showAlert('3品すべての商品を選択してください', 'error');
            return;
        }

        // 選択された商品を取得
        const selectedProducts = [product1Id, product2Id, product3Id]
            .map(id => this.data.products.find(p => p.id == id))
            .filter(p => p);

        if (selectedProducts.length !== 3) {
            this.showAlert('選択された商品に問題があります', 'error');
            return;
        }

        const course = {
            id: Date.now(),
            name: document.getElementById('course-name').value,
            price: parseInt(document.getElementById('course-price').value),
            cost: parseInt(document.getElementById('course-cost').value),
            description: document.getElementById('course-description').value,
            ingredients: document.getElementById('course-ingredients').value,
            selectedProducts: selectedProducts.map(p => ({
                id: p.id,
                name: p.name,
                cost: p.cost,
                category: p.category
            }))
        };

        this.data.courses.push(course);
        this.saveData();
        this.updateCourseDisplay();
        this.updateMenuTypeSelector(); // メニュータイプ選択肢を更新
        this.updateDailyMenuPriceDisplay(); // 日替わりメニュー価格も更新
        this.showAlert('コースが登録されました', 'success');
        e.target.reset();
        this.updateCourseCalculation(); // 計算表示をリセット
    }

    // 新規商品登録の処理
    handleProduct(e) {
        e.preventDefault();
        
        // 選択された素材情報を取得
        const selectedMaterialsText = document.getElementById('selected-materials-text').textContent;
        const totalMaterialCostText = document.getElementById('total-material-cost').textContent;
        const totalMaterialCost = parseInt(totalMaterialCostText.replace(/[¥,]/g, '')) || 0;

        const product = {
            id: Date.now(),
            name: document.getElementById('product-name').value,
            category: document.getElementById('product-category').value,
            price: 10000, // 移動販売固定価格
            cost: parseInt(document.getElementById('product-cost').value),
            description: document.getElementById('product-description').value || 'なし',
            materials: selectedMaterialsText !== 'なし' ? selectedMaterialsText : null,
            craftYield: document.getElementById('product-craft-yield').value ? parseInt(document.getElementById('product-craft-yield').value) : null,
            totalMaterialCost: totalMaterialCost > 0 ? totalMaterialCost : null
        };

        this.data.products.push(product);
        this.saveData();
        this.updateProductDisplay();
        this.updateProductManagementDisplay();
        this.initializeCourseProductSelector(); // 商品選択肢を更新
        this.updateDailyMenuProductSelector(); // 日替わりメニュー商品選択肢を更新
        this.showAlert('商品が登録されました', 'success');
        e.target.reset();
        this.resetMaterialSelector();
    }

    // 素材登録の処理
    handleMaterial(e) {
        e.preventDefault();
        
        const materialName = document.getElementById('material-name').value;
        const materialPrice = parseInt(document.getElementById('material-price').value);

        // 既存の素材名をチェック
        if (this.materials[materialName]) {
            this.showAlert('この素材名は既に登録されています', 'error');
            return;
        }

        // 素材をマスターデータに追加
        this.materials[materialName] = materialPrice;
        
        // 素材の履歴を保存（削除・編集用）
        if (!this.data.materialHistory) {
            this.data.materialHistory = [];
        }
        
        this.data.materialHistory.push({
            id: Date.now(),
            name: materialName,
            price: materialPrice,
            action: 'add',
            timestamp: new Date().toISOString()
        });

        this.saveData();
        this.updateMaterialDisplay();
        this.updateMaterialManagementDisplay();
        this.setupMaterialSelector(); // 商品作成時の素材選択UIを更新
        this.showAlert('素材が登録されました', 'success');
        e.target.reset();
    }

    // 貯金予定に追加（売上の50%）
    addToPendingSavings(amount) {
        const savingsAmount = Math.floor(amount * 0.5);
        this.data.pendingSavings += savingsAmount;
        this.saveData();
        this.updateVaultDisplay();
    }

    // 貯金予定額を実際に貯金
    depositPendingSavings() {
        if (this.data.pendingSavings === 0) {
            this.showAlert('貯金予定額がありません', 'info');
            return;
        }

        const transaction = {
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            type: 'deposit',
            amount: this.data.pendingSavings,
            description: '売上からの自動貯金（50%）'
        };

        this.data.vaultTransactions.push(transaction);
        this.data.pendingSavings = 0;
        this.saveData();
        this.updateVaultDisplay();
        this.showAlert(`¥${transaction.amount.toLocaleString()}を金庫に貯金しました`, 'success');
    }

    // 貯金予定をクリア
    clearPendingSavings() {
        if (this.data.pendingSavings === 0) {
            this.showAlert('貯金予定額がありません', 'info');
            return;
        }

        if (confirm(`貯金予定額 ¥${this.data.pendingSavings.toLocaleString()} をクリアしますか？`)) {
            this.data.pendingSavings = 0;
            this.saveData();
            this.updateVaultDisplay();
            this.showAlert('貯金予定をクリアしました', 'success');
        }
    }

    // 金庫残高を調整
    adjustVaultBalance() {
        const targetBalance = parseInt(document.getElementById('target-balance').value);
        
        if (!targetBalance || targetBalance < 0) {
            this.showAlert('正しい金額を入力してください', 'error');
            return;
        }
        
        // 現在の残高を計算
        let currentBalance = 0;
        this.data.vaultTransactions.forEach(transaction => {
            if (transaction.type === 'deposit') {
                currentBalance += transaction.amount;
            } else {
                currentBalance -= transaction.amount;
            }
        });
        
        const adjustmentAmount = targetBalance - currentBalance;
        
        if (confirm(`金庫残高を ¥${targetBalance.toLocaleString()} に調整しますか？\n（現在: ¥${currentBalance.toLocaleString()}, 調整額: ¥${adjustmentAmount.toLocaleString()}）`)) {
            // 調整用トランザクションを追加
            const adjustmentTransaction = {
                id: Date.now(),
                type: adjustmentAmount > 0 ? 'deposit' : 'withdrawal',
                amount: Math.abs(adjustmentAmount),
                description: `残高調整 (¥${currentBalance.toLocaleString()} → ¥${targetBalance.toLocaleString()})`,
                date: new Date().toISOString()
            };
            
            this.data.vaultTransactions.push(adjustmentTransaction);
            this.data.pendingSavings = 0; // 調整時は貯金予定もクリア
            
            this.saveData();
            this.updateVaultDisplay();
            document.getElementById('target-balance').value = '';
            
            this.showAlert(`金庫残高を ¥${targetBalance.toLocaleString()} に調整しました`, 'success');
        }
    }

    // 金庫データをリセット
    resetVaultData() {
        if (confirm('⚠️ 金庫データを完全にリセットしますか？\nこの操作は元に戻せません。')) {
            if (confirm('本当にリセットしますか？すべての金庫履歴が削除されます。')) {
                this.data.vaultTransactions = [];
                this.data.pendingSavings = 0;
                
                this.saveData();
                this.updateVaultDisplay();
                
                this.showAlert('金庫データをリセットしました', 'success');
            }
        }
    }

    // カレンダー機能の初期化
    initializeAttendanceCalendar() {
        // カレンダーナビゲーションのイベントリスナー
        document.getElementById('prev-month').addEventListener('click', () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
            this.updateAttendanceCalendar();
        });
        
        document.getElementById('next-month').addEventListener('click', () => {
            this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
            this.updateAttendanceCalendar();
        });
        
        // 初期表示
        this.updateAttendanceCalendar();
    }

    // 週間カレンダー機能の初期化
    initializeWeeklyCalendar() {
        // 今週の開始日（月曜日）を設定
        const today = new Date();
        const day = today.getDay();
        // 月曜日（1）を基準とした週の開始日を計算
        const diff = ((day - 1 + 7) % 7); // 月曜日を開始日とする
        this.currentWeekStart = new Date(today.setDate(today.getDate() - diff));
        
        // 週間カレンダーナビゲーションのイベントリスナー
        document.getElementById('prev-week').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
            this.updateWeeklyCalendar();
            this.calculateCurrentWeekStats(); // 週変更時に自動計算
        });
        
        document.getElementById('next-week').addEventListener('click', () => {
            this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
            this.updateWeeklyCalendar();
            this.calculateCurrentWeekStats(); // 週変更時に自動計算
        });
        
        // 初期表示と統計計算
        this.updateWeeklyCalendar();
        this.calculateCurrentWeekStats();
    }

    // 週間カレンダーの更新
    updateWeeklyCalendar() {
        // 週の範囲表示を更新
        const weekEnd = new Date(this.currentWeekStart);
        weekEnd.setDate(this.currentWeekStart.getDate() + 6);
        
        const startStr = this.formatDate(this.currentWeekStart.toISOString().split('T')[0]);
        const endStr = this.formatDate(weekEnd.toISOString().split('T')[0]);
        document.getElementById('current-week-range').textContent = 
            `${startStr} ～ ${endStr}`;
        
        // 週間カレンダーの生成
        this.generateWeeklyCalendar();
    }

    // 週間カレンダーの生成
    generateWeeklyCalendar() {
        const container = document.getElementById('weekly-attendance-calendar');
        const today = new Date();
        
        // カレンダーヘッダー（月曜日始まり）
        const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
        let html = weekdays.map(day => 
            `<div class="weekly-calendar-header">${day}</div>`
        ).join('');

        // 7日分のカレンダーセル
        for (let i = 0; i < 7; i++) {
            const date = new Date(this.currentWeekStart);
            date.setDate(this.currentWeekStart.getDate() + i);
            
            // 日付文字列を正確に生成
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const isToday = date.toDateString() === today.toDateString();
            
            // その日の出勤データを取得
            const dayAttendance = this.data.attendance.filter(item => 
                item.date.startsWith(dateString)
            );
            
            // 従業員別出勤数を集計
            const employeeStats = {};
            dayAttendance.forEach(attendance => {
                if (!employeeStats[attendance.employeeName]) {
                    employeeStats[attendance.employeeName] = 0;
                }
                employeeStats[attendance.employeeName]++;
            });
            
            let cellClass = 'weekly-calendar-day';
            if (isToday) cellClass += ' today';
            
            // 従業員出勤表示
            let attendanceDisplay = '';
            if (Object.keys(employeeStats).length > 0) {
                attendanceDisplay = Object.entries(employeeStats).map(([name, count]) => {
                    const countClass = count > 1 ? 'multiple' : '';
                    const countText = count > 1 ? ` (${count})` : '';
                    return `<div class="weekly-attendance-employee ${countClass}">${name}${countText}</div>`;
                }).join('');
            } else {
                attendanceDisplay = '<div class="weekly-no-attendance">未出勤</div>';
            }
            
                         html += `
                 <div class="${cellClass}">
                     <div class="weekly-day-header">${date.getDate()}</div>
                     <div class="weekly-attendance-list">
                         ${attendanceDisplay}
                     </div>
                 </div>
             `;
         }
         
         container.innerHTML = html;
     }

     // 現在の週の統計を自動計算
     calculateCurrentWeekStats() {
         const weekEnd = new Date(this.currentWeekStart);
         weekEnd.setDate(this.currentWeekStart.getDate() + 6);
         
         // 日付文字列を生成
         const startStr = this.formatDateForFilter(this.currentWeekStart);
         const endStr = this.formatDateForFilter(weekEnd);
         
         // 週間出勤データを取得
         const weeklyAttendance = this.data.attendance.filter(item => {
             const itemDate = item.date.split('T')[0]; // 日付部分のみ取得
             return itemDate >= startStr && itemDate <= endStr;
         });

         // 従業員別統計を計算
         const employeeStats = {};
         weeklyAttendance.forEach(attendance => {
             if (!employeeStats[attendance.employeeName]) {
                 employeeStats[attendance.employeeName] = {
                     name: attendance.employeeName,
                     days: 0
                 };
             }
             employeeStats[attendance.employeeName].days++;
         });

         // ボーナス計算を更新
         this.calculateCurrentWeekBonus(employeeStats, startStr);
     }

     // 日付をフィルター用文字列に変換
     formatDateForFilter(date) {
         const year = date.getFullYear();
         const month = String(date.getMonth() + 1).padStart(2, '0');
         const day = String(date.getDate()).padStart(2, '0');
         return `${year}-${month}-${day}`;
     }

     // 現在の週のボーナス計算
     calculateCurrentWeekBonus(stats, weekStart) {
         const container = document.getElementById('bonus-calculation');
         const employees = Object.values(stats);

         // 週の範囲を計算
         const weekEnd = new Date(this.currentWeekStart);
         weekEnd.setDate(this.currentWeekStart.getDate() + 6);
         
         // 次の月曜日（支給日）を計算
         const nextMonday = new Date(weekEnd);
         nextMonday.setDate(weekEnd.getDate() + 1);
         
         if (employees.length === 0) {
             const html = `
                 <div class="bonus-period-info">
                     <h4>📅 ${this.formatDate(weekStart)} ～ ${this.formatDate(this.formatDateForFilter(weekEnd))} の週</h4>
                     <p><strong>次回支給日:</strong> ${this.formatDate(this.formatDateForFilter(nextMonday))}（月曜日）</p>
                 </div>
                 <div class="empty-state">この週は出勤記録がありません</div>
             `;
             container.innerHTML = html;
             return;
         }

         // 総出勤日数を計算
         const totalDays = employees.reduce((sum, emp) => sum + emp.days, 0);
         const totalBonus = employees.reduce((sum, emp) => sum + (emp.days * this.bonusPerDay), 0);

         const html = `
             <div class="bonus-period-info">
                 <h4>📅 ${this.formatDate(weekStart)} ～ ${this.formatDate(this.formatDateForFilter(weekEnd))} の週</h4>
                 <p><strong>次回支給日:</strong> ${this.formatDate(this.formatDateForFilter(nextMonday))}（月曜日）</p>
                 <div class="bonus-summary">
                     <div class="summary-item">
                         <span class="label">総出勤日数:</span>
                         <span class="value">${totalDays}日</span>
                     </div>
                     <div class="summary-item">
                         <span class="label">支給総額:</span>
                         <span class="value total-amount">¥${totalBonus.toLocaleString()}</span>
                     </div>
                 </div>
             </div>
             
             <div class="bonus-details">
                 <h5>👥 従業員別ボーナス詳細</h5>
                 ${employees.map(emp => {
                     const bonus = emp.days * this.bonusPerDay;
                     return `
                         <div class="bonus-employee-item">
                             <div class="employee-info">
                                 <div class="employee-name">${emp.name}</div>
                                 <div class="employee-days">出勤: ${emp.days}日</div>
                             </div>
                             <div class="employee-bonus">¥${bonus.toLocaleString()}</div>
                         </div>
                     `;
                 }).join('')}
             </div>
         `;
         
         container.innerHTML = html;
     }

    // 出勤カレンダーの更新
    updateAttendanceCalendar() {
        const year = this.currentCalendarDate.getFullYear();
        const month = this.currentCalendarDate.getMonth();
        
        // 月年表示の更新
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', 
                           '7月', '8月', '9月', '10月', '11月', '12月'];
        document.getElementById('current-month-year').textContent = 
            `${year}年 ${monthNames[month]}`;
        
        // カレンダーの生成
        this.generateCalendar(year, month);
    }

    // カレンダーの生成
    generateCalendar(year, month) {
        const container = document.getElementById('attendance-calendar');
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const today = new Date();
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // カレンダーヘッダー
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        let html = weekdays.map(day => 
            `<div class="calendar-header">${day}</div>`
        ).join('');

        // カレンダー日付セル
        for (let i = 0; i < 42; i++) { // 6週分
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            // 日付文字列を正確に生成（タイムゾーンバグ修正）
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            
            const isCurrentMonth = date.getMonth() === this.currentCalendarDate.getMonth();
            const isToday = date.toDateString() === today.toDateString();
            const isSelected = this.selectedDate === dateString;
            
            // その日の出勤データを取得
            const dayAttendance = this.data.attendance.filter(item => 
                item.date.startsWith(dateString)
            );
            
            let cellClass = 'calendar-day';
            if (!isCurrentMonth) cellClass += ' other-month';
            if (isToday) cellClass += ' today';
            if (isSelected) cellClass += ' selected';
            
            // 出勤インジケーター
            let attendanceIndicator = '';
            if (dayAttendance.length > 0) {
                const dots = dayAttendance.length > 2 ? 2 : dayAttendance.length;
                const dotClass = dayAttendance.length > 1 ? 'multiple' : '';
                attendanceIndicator = `
                    <div class="attendance-indicator">
                        ${Array(dots).fill().map(() => 
                            `<div class="attendance-dot ${dotClass}"></div>`
                        ).join('')}
                        ${dayAttendance.length > 2 ? 
                            `<div class="attendance-count">+${dayAttendance.length - 2}</div>` : ''}
                    </div>
                `;
            }
            
            html += `
                <div class="${cellClass}" data-date="${dateString}" 
                     onclick="rushLounge.selectCalendarDate('${dateString}')">
                    <div class="day-number">${date.getDate()}</div>
                    ${attendanceIndicator}
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    // カレンダー日付選択
    selectCalendarDate(dateString) {
        // 前の選択を解除
        document.querySelectorAll('.calendar-day.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 新しい選択を設定
        this.selectedDate = dateString;
        document.querySelector(`[data-date="${dateString}"]`).classList.add('selected');
        
        // 選択日の詳細表示を更新
        this.updateSelectedDateDetails(dateString);
    }

    // 選択日の詳細表示更新
    updateSelectedDateDetails(dateString) {
        const container = document.getElementById('selected-date-details');
        const selectedAttendance = this.data.attendance.filter(item => 
            item.date.startsWith(dateString)
        );

        // 簡易出勤記録フォーム
        const activeEmployees = this.data.employees ? this.data.employees.filter(emp => emp.active) : [];
        const employeeOptions = activeEmployees.map(employee => 
            `<option value="${employee.name}">${employee.name}</option>`
        ).join('');

        const quickAttendanceForm = `
            <div class="quick-attendance-form">
                <h4>📝 ${this.formatDate(dateString)} の出勤記録</h4>
                <form id="quick-attendance-form" onsubmit="rushLounge.handleQuickAttendance(event, '${dateString}')">
                    <div class="form-row">
                        <select id="quick-employee-name" required>
                            <option value="">従業員を選択</option>
                            ${employeeOptions}
                        </select>
                        <input type="time" id="quick-attendance-time" required>
                        <button type="submit" class="btn btn-primary">出勤記録</button>
                    </div>
                </form>
            </div>
        `;

        // 既存の出勤記録表示
        const attendanceList = selectedAttendance.length > 0 ? `
            <div class="existing-attendance">
                <h5>📋 既存の出勤記録</h5>
                ${selectedAttendance.map(item => `
                    <div class="attendance-item">
                        <div class="history-date">${this.formatDateTime(item.date)}</div>
                        <div class="history-details">
                            <div><strong>従業員:</strong> ${item.employeeName}</div>
                        </div>
                        <button class="btn btn-danger" onclick="rushLounge.deleteRecord('attendance', ${item.id})">削除</button>
                    </div>
                `).join('')}
            </div>
        ` : `
            <div class="existing-attendance">
                <p class="no-records">まだ出勤記録がありません</p>
            </div>
        `;

        const html = `
            <div class="selected-date-title">${this.formatDate(dateString)} の出勤管理</div>
            ${quickAttendanceForm}
            ${attendanceList}
        `;
        
        container.innerHTML = html;
        
        // 現在時刻を設定
        this.setCurrentTimeForQuickForm();
    }

    // 簡易出勤フォームの現在時刻設定
    setCurrentTimeForQuickForm() {
        const timeInput = document.getElementById('quick-attendance-time');
        if (timeInput) {
            const now = new Date();
            // 日本標準時（UTC+9）に変換
            const jstOffset = 9 * 60;
            const jstTime = new Date(now.getTime() + (jstOffset * 60 * 1000));
            
            const hours = String(jstTime.getUTCHours()).padStart(2, '0');
            const minutes = String(jstTime.getUTCMinutes()).padStart(2, '0');
            timeInput.value = `${hours}:${minutes}`;
        }
    }

    // 簡易出勤記録の処理
    handleQuickAttendance(event, dateString) {
        event.preventDefault();
        
        const employeeName = document.getElementById('quick-employee-name').value;
        const time = document.getElementById('quick-attendance-time').value;
        const dateTime = `${dateString}T${time}:00`;

        // 1日1回の制限チェック
        const existingAttendance = this.data.attendance.find(item => 
            item.employeeName === employeeName && 
            this.extractDateFromDateTime(item.date) === dateString
        );

        if (existingAttendance) {
            alert(`⚠️ 重複記録エラー\n\n${employeeName}は既に${this.formatDate(dateString)}に出勤記録があります。\n\n各従業員は1日1回まで記録可能です。`);
            return;
        }

        const attendance = {
            id: Date.now(),
            employeeName: employeeName,
            date: dateTime,
            timestamp: new Date().toISOString()
        };

        this.data.attendance.push(attendance);
        this.saveData();
        
        // カレンダーと詳細表示を更新
        this.updateAttendanceCalendar();
        this.updateSelectedDateDetails(dateString);
        this.updateAttendanceDisplay(); // 出勤状況も更新
        this.calculateCurrentWeekStats(); // 週間統計も自動更新
        
        this.showAlert(`${employeeName}の出勤記録を追加しました（${this.formatDate(dateString)} ${time}）`, 'success');
        
        // フォームをリセット
        document.getElementById('quick-employee-name').value = '';
        this.setCurrentTimeForQuickForm();
    }

    // 出勤表示の更新
    updateAttendanceDisplay() {
        // カレンダーの更新
        this.updateAttendanceCalendar();
        
        // 週間カレンダーの更新
        this.updateWeeklyCalendar();
        
        // 週間統計の自動更新
        this.calculateCurrentWeekStats();

        // 選択日の詳細も更新（選択されている場合）
        if (this.selectedDate) {
            this.updateSelectedDateDetails(this.selectedDate);
        }
        
        // 従業員セレクター更新の頻度制御
        this.debouncedUpdateEmployeeSelectors();
    }
    
    // 従業員セレクター更新の遅延実行
    debouncedUpdateEmployeeSelectors() {
        // 前回の更新から一定時間経過している場合のみ実行
        const now = Date.now();
        const lastUpdate = this.lastEmployeeSelectorUpdate || 0;
        const timeSinceLastUpdate = now - lastUpdate;
        
        if (timeSinceLastUpdate > 1000) { // 1秒以上経過している場合のみ更新
            this.updateEmployeeSelectors();
            this.lastEmployeeSelectorUpdate = now;
        }
    }

    // 現在の日替わりメニュー表示更新
    updateCurrentDailyMenu() {
        const container = document.getElementById('current-daily-menu');
        const today = new Date().toISOString().split('T')[0];
        const todayMenu = this.data.dailyMenuConfigs.find(config => config.date === today);

        if (!todayMenu) {
            container.innerHTML = '<div class="no-menu-set">今日の日替わりメニューが設定されていません</div>';
            return;
        }

        const html = `
            <div class="current-menu-date">📅 ${this.formatDate(todayMenu.date)}の日替わりメニュー</div>
            <div class="current-menu-items">
                ${todayMenu.items.map(item => `<div class="menu-item">${item}</div>`).join('')}
            </div>
            <div class="current-menu-price">セット価格: ¥${todayMenu.price.toLocaleString()}</div>
        `;
        
        container.innerHTML = html;
    }

    // 日替わりメニュー設定履歴表示更新
    updateDailyMenuConfigDisplay() {
        const container = document.getElementById('daily-menu-configs');
        
        if (this.data.dailyMenuConfigs.length === 0) {
            container.innerHTML = '<div class="empty-state">日替わりメニューの設定がありません</div>';
            return;
        }

        const html = this.data.dailyMenuConfigs.slice(-10).reverse().map(config => `
            <div class="config-item">
                <div class="config-date">${this.formatDate(config.date)}</div>
                <div class="config-details">
                    <div class="config-items">
                        <h5>構成商品:</h5>
                        <ul>
                            ${config.items.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="config-price">¥${config.price.toLocaleString()}</div>
                </div>
                <button class="btn btn-danger" onclick="rushLounge.deleteRecord('dailyMenuConfigs', ${config.id})">削除</button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // 日替わりメニュー売上履歴表示更新
    updateDailyMenuDisplay() {
        const container = document.getElementById('daily-menu-history');
        
        if (this.data.dailyMenu.length === 0) {
            container.innerHTML = '<div class="empty-state">日替わりメニューの売上記録がありません</div>';
            return;
        }

        const html = this.data.dailyMenu.slice().reverse().map(item => `
            <div class="history-item">
                <div class="history-date">${this.formatDate(item.date)}</div>
                <div class="history-details">
                    <div class="config-items">
                        <h5>提供商品:</h5>
                        <ul>
                            ${item.menuItems ? item.menuItems.map(menu => `<li>${menu}</li>`).join('') : '<li>情報なし</li>'}
                        </ul>
                    </div>
                    <div><strong>数量:</strong> ${item.quantity}セット</div>
                    <div><strong>単価:</strong> ¥${item.price.toLocaleString()}</div>
                    <div><strong>合計:</strong> ¥${item.total.toLocaleString()}</div>
                </div>
                <button class="btn btn-danger" onclick="rushLounge.deleteRecord('dailyMenu', ${item.id})">削除</button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // 通常メニュー表示の更新
    updateRegularMenuDisplay() {
        const container = document.getElementById('regular-menu-history');
        
        if (!this.data.regularMenu || this.data.regularMenu.length === 0) {
            container.innerHTML = '<div class="empty-state">その他メニューの売上記録がありません</div>';
            return;
        }

        const html = this.data.regularMenu.slice().reverse().map(item => {
            // データ構造の確認と修正
            const menuName = item.menuName || item.course || this.getMenuTypeName(item.menuType) || 'メニュー';
            const price = item.price || item.amount || 0;
            const total = item.total || item.amount || (item.price * (item.quantity || 1)) || price;
            const quantity = item.quantity || 1;
            const menuItems = item.menuItems || item.items || [];
            const staff = item.staff || item.employeeName || 'スタッフ';
            
            return `
                <div class="history-item">
                    <div class="history-date">${this.formatDate(item.date)}</div>
                    <div class="history-details">
                        <div><strong>担当:</strong> ${staff}</div>
                        <div><strong>メニュー:</strong> ${menuName}</div>
                        ${menuItems && menuItems.length > 0 ? `
                            <div class="config-items">
                                <h5>構成商品:</h5>
                                <ul>
                                    ${menuItems.map(menu => `<li>${menu}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        <div><strong>数量:</strong> ${quantity}セット</div>
                        <div><strong>単価:</strong> ¥${price.toLocaleString()}</div>
                        <div><strong>合計:</strong> ¥${total.toLocaleString()}</div>
                    </div>
                    <button class="btn btn-danger" onclick="rushLounge.deleteRecord('regularMenu', ${item.id})">削除</button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        
        // 統計表示も更新
        this.updateRegularMenuStats();
    }

    // その他収益表示の更新
    updateOtherRevenueDisplay() {
        const container = document.getElementById('other-revenue-history');
        
        if (this.data.otherRevenue.length === 0) {
            container.innerHTML = '<div class="empty-state">その他収益の記録がありません</div>';
            return;
        }

        const html = this.data.otherRevenue.slice().reverse().map(item => `
            <div class="history-item">
                <div class="history-date">${this.formatDate(item.date)}</div>
                <div class="history-details">
                    <div><strong>種別:</strong> ${this.getRevenueTypeName(item.type)}</div>
                    <div><strong>内容:</strong> ${item.description}</div>
                    <div><strong>金額:</strong> ¥${item.amount.toLocaleString()}</div>
                </div>
                <button class="btn btn-danger" onclick="rushLounge.deleteRecord('otherRevenue', ${item.id})">削除</button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // 支出表示の更新
    updateExpenseDisplay() {
        const container = document.getElementById('expense-history');
        
        if (this.data.expenses.length === 0) {
            container.innerHTML = '<div class="empty-state">支出記録がありません</div>';
            return;
        }

        const html = this.data.expenses.slice().reverse().map(item => `
            <div class="history-item">
                <div class="history-date">${this.formatDate(item.date)}</div>
                <div class="history-details">
                    <div><strong>種別:</strong> ${this.getExpenseCategoryName(item.category)}</div>
                    <div><strong>内容:</strong> ${item.description}</div>
                    <div><strong>金額:</strong> ¥${item.amount.toLocaleString()}</div>
                </div>
                <button class="btn btn-danger" onclick="rushLounge.deleteRecord('expenses', ${item.id})">削除</button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // 金庫表示の更新
    updateVaultDisplay() {
        // 残高計算
        let balance = 0;
        this.data.vaultTransactions.forEach(transaction => {
            if (transaction.type === 'deposit') {
                balance += transaction.amount;
            } else {
                balance -= transaction.amount;
            }
        });

        // 残高表示更新
        document.getElementById('vault-balance').textContent = `¥${balance.toLocaleString()}`;

        // 貯金予定表示更新
        document.getElementById('pending-savings').textContent = `¥${this.data.pendingSavings.toLocaleString()}`;

        // 取引履歴表示
        const container = document.getElementById('vault-history');
        
        if (this.data.vaultTransactions.length === 0) {
            container.innerHTML = '<div class="empty-state">取引履歴がありません</div>';
            return;
        }

        const html = this.data.vaultTransactions.slice().reverse().map(item => `
            <div class="history-item">
                <div class="history-date">${this.formatDate(item.date)}</div>
                <div class="history-details">
                    <div><strong>種別:</strong> ${item.type === 'deposit' ? '入金' : '出金'}</div>
                    <div><strong>内容:</strong> ${item.description}</div>
                    <div><strong>金額:</strong> ${item.type === 'deposit' ? '+' : '-'}¥${item.amount.toLocaleString()}</div>
                </div>
                <button class="btn btn-danger" onclick="rushLounge.deleteRecord('vaultTransactions', ${item.id})">削除</button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // コース表示の更新
    updateCourseDisplay() {
        const container = document.getElementById('course-list-display');
        
        if (this.data.courses.length === 0) {
            container.innerHTML = '<div class="empty-state">登録されたコースがありません</div>';
            return;
        }

        const html = this.data.courses.map(course => {
            const profit = course.price - course.cost;
            const profitMargin = ((profit / course.price) * 100).toFixed(1);
            
            return `
                <div class="course-item">
                    <div class="course-header">
                        <div class="course-name">${course.name}</div>
                        <div class="course-profit">利益: ¥${profit.toLocaleString()} (${profitMargin}%)</div>
                    </div>
                    <div class="course-details">
                        <div><strong>販売価格:</strong> ¥${course.price.toLocaleString()}</div>
                        <div><strong>原価:</strong> ¥${course.cost.toLocaleString()}</div>
                        <div><strong>内容:</strong> ${course.description || 'なし'}</div>
                    </div>
                    ${course.selectedProducts && course.selectedProducts.length > 0 ? `
                        <div class="course-ingredients">
                            <strong>構成商品 (3品):</strong><br>
                            ${course.selectedProducts.map((product, index) => 
                                `${index + 1}. ${product.name} (${this.getProductCategoryName(product.category)}) - 原価: ¥${product.cost.toLocaleString()}`
                            ).join('<br>')}
                        </div>
                    ` : ''}
                    ${course.ingredients ? `
                        <div class="course-ingredients">
                            <strong>使用食材:</strong><br>
                            ${course.ingredients.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                    <button class="btn btn-danger" onclick="rushLounge.deleteRecord('courses', ${course.id})">削除</button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // 商品表示の更新
    updateProductDisplay() {
        const container = document.getElementById('product-list-display');
        
        if (this.data.products.length === 0) {
            container.innerHTML = '<div class="empty-state">登録された商品がありません</div>';
            return;
        }

        const html = this.data.products.map(product => {
            const profit = product.price - product.cost;
            const profitMargin = ((profit / product.price) * 100).toFixed(1);
            
            return `
                <div class="product-item">
                    <div class="product-header">
                        <div class="product-name">${product.name}</div>
                        <div class="product-category ${product.category}">${this.getProductCategoryName(product.category)}</div>
                    </div>
                    <div class="product-details">
                        <div><strong>説明:</strong> ${product.description}</div>
                        <div class="product-usage-info">
                            <div>🏪 <strong>店舗:</strong> コース提供のみ（単品販売なし）</div>
                            <div>🚚 <strong>移動販売:</strong> 単品 ¥${product.price.toLocaleString()}</div>
                        </div>
                        <div class="product-specs">
                            <div><strong>原価:</strong> ¥${product.cost.toLocaleString()}</div>
                            <div><strong>移動販売利益:</strong> ¥${profit.toLocaleString()} (${profitMargin}%)</div>
                            ${product.craftYield ? `<div><strong>完成数:</strong> ${product.craftYield}個</div>` : ''}
                            ${product.totalMaterialCost ? `<div><strong>総素材コスト:</strong> ¥${product.totalMaterialCost.toLocaleString()}</div>` : ''}
                        </div>
                        ${product.materials ? `<div><strong>必要素材:</strong> ${product.materials}</div>` : ''}
                    </div>
                    <button class="btn btn-danger" onclick="rushLounge.deleteRecord('products', ${product.id})">削除</button>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // 素材一覧の表示更新
    updateMaterialDisplay() {
        const container = document.getElementById('material-list-display');
        
        if (Object.keys(this.data.materialHistory).length === 0) {
            container.innerHTML = '<div class="empty-state">登録された素材がありません</div>';
            return;
        }
        
        const html = Object.entries(this.data.materialHistory).map(([name, price]) => {
            return `
                <div class="material-item">
                    <div class="product-header">
                        <div class="product-name">${name}</div>
                        <div class="product-category other">素材</div>
                    </div>
                    <div class="product-details">
                        <div><strong>仕入れ価格:</strong> ¥${price.toLocaleString()}</div>
                        <div><strong>単位:</strong> 1個</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // サブタブ表示の更新
    updateSubTabDisplay(subTabName) {
        switch (subTabName) {
            case 'new-course':
                this.updateCourseDisplay();
                break;
            case 'new-product':
                this.updateProductDisplay();
                this.setupMaterialSelector();
                break;
            case 'new-material':
                this.updateMaterialDisplay();
                break;
            case 'manage-list':
                this.updateCourseManagementDisplay();
                this.updateProductManagementDisplay();
                this.updateMaterialManagementDisplay();
                break;
        }
    }

    // 売上統計の更新
    updateSalesStats() {
        const dailyTotal = this.data.dailyMenu.reduce((sum, item) => sum + (item.total || item.amount || 0), 0);
        
        // regularMenuの集計を修正
        const regularTotal = this.data.regularMenu.reduce((sum, item) => {
            const amount = item.total || item.amount || (item.price * (item.quantity || 1)) || 0;
            return sum + amount;
        }, 0);
        
        const otherTotal = this.data.otherRevenue.reduce((sum, item) => sum + item.amount, 0);
        const totalSales = dailyTotal + regularTotal + otherTotal;

        document.getElementById('daily-total').textContent = `¥${dailyTotal.toLocaleString()}`;
        document.getElementById('regular-total').textContent = `¥${regularTotal.toLocaleString()}`;
        document.getElementById('other-total').textContent = `¥${otherTotal.toLocaleString()}`;
        document.getElementById('total-sales').textContent = `¥${totalSales.toLocaleString()}`;
        
        this.updateSalesHistory();
    }

    // 売上履歴の更新
    updateSalesHistory() {
        const container = document.getElementById('all-sales-history');
        const allSales = [
            ...this.data.dailyMenu.map(item => ({ 
                ...item, 
                category: '日替わりメニュー',
                menuName: item.menuItems ? item.menuItems.join(', ') : '情報なし',
                amount: item.total || item.amount || 0
            })),
            ...this.data.regularMenu.map(item => {
                const menuName = item.menuName || item.course || this.getMenuTypeName(item.menuType) || 'メニュー';
                const displayName = item.menuItems || item.items ? 
                    (item.menuItems || item.items).join(', ') : menuName;
                const amount = item.total || item.amount || (item.price * (item.quantity || 1)) || 0;
                
                return { 
                    ...item, 
                    category: 'その他メニュー', 
                    menuName: menuName,
                    displayName: displayName,
                    amount: amount,
                    staff: item.staff || item.employeeName || 'スタッフ'
                };
            }),
            ...this.data.otherRevenue.map(item => ({ 
                ...item, 
                category: 'その他収益', 
                amount: item.amount, 
                menuName: item.description 
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allSales.length === 0) {
            container.innerHTML = '<div class="empty-state">売上記録がありません</div>';
            return;
        }

        const html = allSales.map(item => `
            <div class="history-item">
                <div class="history-date">${this.formatDate(item.date)}</div>
                <div class="history-details">
                    <div><strong>カテゴリ:</strong> ${item.category}</div>
                    ${item.staff ? `<div><strong>担当:</strong> ${item.staff}</div>` : ''}
                    <div><strong>内容:</strong> ${item.displayName || item.menuName || 'N/A'}</div>
                    <div><strong>数量:</strong> ${item.quantity || 1}${(item.category === '日替わりメニュー' || item.category === 'その他メニュー') ? 'セット' : ''}</div>
                    <div><strong>金額:</strong> ¥${item.amount.toLocaleString()}</div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
    }

    // 財務統計の更新
    updateFinancialStats() {
        const totalIncome = this.getTotalIncome();
        const totalExpenses = this.data.expenses.reduce((sum, item) => sum + item.amount, 0);
        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

        document.getElementById('total-income').textContent = `¥${totalIncome.toLocaleString()}`;
        document.getElementById('total-expenses').textContent = `¥${totalExpenses.toLocaleString()}`;
        document.getElementById('net-profit').textContent = `¥${netProfit.toLocaleString()}`;
        document.getElementById('profit-margin').textContent = `${profitMargin}%`;
    }

    // 総収入の計算
    getTotalIncome() {
        const dailyTotal = this.data.dailyMenu.reduce((sum, item) => sum + (item.total || item.amount || 0), 0);
        const regularTotal = this.data.regularMenu.reduce((sum, item) => {
            const amount = item.total || item.amount || (item.price * (item.quantity || 1)) || 0;
            return sum + amount;
        }, 0);
        const otherTotal = this.data.otherRevenue.reduce((sum, item) => sum + item.amount, 0);
        return dailyTotal + regularTotal + otherTotal;
    }

    // 週間統計の計算
    calculateWeeklyStats() {
        const weekStart = document.getElementById('week-start').value;
        if (!weekStart) {
            this.showAlert('週の開始日を選択してください', 'error');
            return;
        }

        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        const weeklyAttendance = this.data.attendance.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });

        const employeeStats = {};
        weeklyAttendance.forEach(attendance => {
            if (!employeeStats[attendance.employeeName]) {
                employeeStats[attendance.employeeName] = {
                    name: attendance.employeeName,
                    days: 0
                };
            }
            employeeStats[attendance.employeeName].days++;
        });

        this.displayWeeklyStats(employeeStats, weekStart);
        this.calculateBonus(employeeStats);
    }

    // 週間統計の表示
    displayWeeklyStats(stats, weekStart) {
        const container = document.getElementById('weekly-stats');
        const employees = Object.values(stats);

        if (employees.length === 0) {
            container.innerHTML = '<div class="empty-state">選択された週に出勤記録がありません</div>';
            return;
        }

        const html = `
            <h4>${this.formatDate(weekStart)}の週の出勤統計</h4>
            ${employees.map(emp => `
                <div class="attendance-item">
                    <div><strong>${emp.name}</strong></div>
                    <div>出勤日数: ${emp.days}日</div>
                </div>
            `).join('')}
        `;
        
        container.innerHTML = html;
    }

    // ボーナス計算
    calculateBonus(stats) {
        const container = document.getElementById('bonus-calculation');
        const employees = Object.values(stats);

        if (employees.length === 0) {
            container.innerHTML = '<div class="empty-state">ボーナス計算対象がありません</div>';
            return;
        }

        const html = `
            <h4>ボーナス計算結果</h4>
            <p>基本ボーナス: ¥${this.bonusPerDay.toLocaleString()}/日</p>
            ${employees.map(emp => {
                const bonus = emp.days * this.bonusPerDay;
                return `
                    <div class="attendance-item">
                        <div><strong>${emp.name}</strong></div>
                        <div>出勤日数: ${emp.days}日</div>
                        <div>ボーナス: ¥${bonus.toLocaleString()}</div>
                    </div>
                `;
            }).join('')}
        `;
        
        container.innerHTML = html;
    }

    // 売上絞り込み
    filterSales() {
        const startDate = document.getElementById('summary-start-date').value;
        const endDate = document.getElementById('summary-end-date').value;

        if (!startDate || !endDate) {
            this.showAlert('開始日と終了日を選択してください', 'error');
            return;
        }

        // フィルタリングしたデータで統計を更新
        this.updateFilteredStats(startDate, endDate);
    }

    // フィルタリングされた統計の更新
    updateFilteredStats(startDate, endDate) {
        const filteredDaily = this.data.dailyMenu.filter(item => 
            item.date >= startDate && item.date <= endDate
        );
        const filteredRegular = this.data.regularMenu.filter(item => 
            item.date >= startDate && item.date <= endDate
        );
        const filteredOther = this.data.otherRevenue.filter(item => 
            item.date >= startDate && item.date <= endDate
        );

        const dailyTotal = filteredDaily.reduce((sum, item) => sum + (item.total || item.amount || 0), 0);
        const regularTotal = filteredRegular.reduce((sum, item) => {
            const amount = item.total || item.amount || (item.price * (item.quantity || 1)) || 0;
            return sum + amount;
        }, 0);
        const otherTotal = filteredOther.reduce((sum, item) => sum + item.amount, 0);
        const totalSales = dailyTotal + regularTotal + otherTotal;

        document.getElementById('daily-total').textContent = `¥${dailyTotal.toLocaleString()}`;
        document.getElementById('regular-total').textContent = `¥${regularTotal.toLocaleString()}`;
        document.getElementById('other-total').textContent = `¥${otherTotal.toLocaleString()}`;
        document.getElementById('total-sales').textContent = `¥${totalSales.toLocaleString()}`;

        this.showAlert(`${startDate}から${endDate}の期間で絞り込みました`, 'info');
    }

    // フィルターリセット
    resetFilter() {
        document.getElementById('summary-start-date').value = '';
        document.getElementById('summary-end-date').value = '';
        this.updateSalesStats();
        this.showAlert('フィルターをリセットしました', 'info');
    }

    // レコード削除
    deleteRecord(category, id) {
        if (confirm('この記録を削除しますか？')) {
            try {
                const targetData = this.data[category];
                if (!targetData) {
                    this.showAlert('指定されたデータカテゴリが見つかりません', 'error');
                    return;
                }

                const recordIndex = targetData.findIndex(item => item.id === id);
                if (recordIndex === -1) {
                    this.showAlert('削除対象のレコードが見つかりません', 'error');
                    return;
                }

                // 削除記録を追跡（Firebase同期時の復元防止）
                if (!this.data.deletedRecords) {
                    this.data.deletedRecords = {};
                }
                if (!this.data.deletedRecords[category]) {
                    this.data.deletedRecords[category] = [];
                }
                
                this.data.deletedRecords[category].push({
                    id: id,
                    deletedAt: new Date().toISOString(),
                    deletedBy: 'user'
                });

                // 支出削除時は関連する金庫取引も削除
                if (category === 'expenses') {
                    this.data.vaultTransactions = this.data.vaultTransactions.filter(
                        transaction => transaction.linkedExpenseId !== id
                    );
                    this.showAlert('支出記録と関連する金庫取引を削除しました', 'success');
                } else {
                    this.showAlert('記録が削除されました', 'success');
                }

                // レコードを削除
                this.data[category].splice(recordIndex, 1);
                
                // データ保存（削除記録も含む）
                this.saveData();
                
                // Firebase同期がある場合は削除をアップロード
                if (this.firebaseRef) {
                    this.uploadCurrentData();
                }
                
                // 表示更新
                this.updateAllDisplays();
                
                // コース削除時はメニュータイプ選択肢も更新
                if (category === 'courses') {
                    this.updateMenuTypeSelector();
                }
                
                // 商品削除時は日替わりメニュー商品選択肢も更新
                if (category === 'products') {
                    this.updateDailyMenuProductSelector();
                }
                
                // 出勤記録削除時は週間統計も自動更新
                if (category === 'attendance') {
                    this.calculateCurrentWeekStats();
                }
                
                console.log(`🗑️ 削除記録: ${category}[${id}] を削除記録に追加`);
            } catch (error) {
                console.error('削除エラー:', error);
                this.showAlert('削除に失敗しました', 'error');
            }
        }
    }

    // コース管理表示の更新
    updateCourseManagementDisplay() {
        const container = document.getElementById('course-management-list');
        
        if (this.data.courses.length === 0) {
            container.innerHTML = '<div class="empty-state">登録されたコースがありません</div>';
            return;
        }

        const html = this.data.courses.map(course => {
            const profit = course.price - course.cost;
            const profitMargin = ((profit / course.price) * 100).toFixed(1);
            
            return `
                <div class="course-item" id="course-${course.id}">
                    <div class="course-header">
                        <div class="course-name">${course.name}</div>
                        <div class="course-profit">利益: ¥${profit.toLocaleString()} (${profitMargin}%)</div>
                    </div>
                    <div class="course-details">
                        <div><strong>販売価格:</strong> ¥${course.price.toLocaleString()}</div>
                        <div><strong>原価:</strong> ¥${course.cost.toLocaleString()}</div>
                        <div><strong>内容:</strong> ${course.description || 'なし'}</div>
                    </div>
                    ${course.selectedProducts && course.selectedProducts.length > 0 ? `
                        <div class="course-ingredients">
                            <strong>構成商品 (3品):</strong><br>
                            ${course.selectedProducts.map((product, index) => 
                                `${index + 1}. ${product.name} (${this.getProductCategoryName(product.category)}) - 原価: ¥${product.cost.toLocaleString()}`
                            ).join('<br>')}
                        </div>
                    ` : ''}
                    ${course.ingredients ? `
                        <div class="course-ingredients">
                            <strong>使用食材:</strong><br>
                            ${course.ingredients.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}
                    <div class="management-buttons">
                        <button class="btn btn-secondary" onclick="rushLounge.editCourse(${course.id})">編集</button>
                        <button class="btn btn-danger" onclick="rushLounge.deleteRecord('courses', ${course.id})">削除</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // 商品管理表示の更新
    updateProductManagementDisplay() {
        const container = document.getElementById('product-management-list');
        
        if (this.data.products.length === 0) {
            container.innerHTML = '<div class="empty-state">登録された商品がありません</div>';
            return;
        }

        const html = this.data.products.map(product => {
            const profit = product.price - product.cost;
            const profitMargin = ((profit / product.price) * 100).toFixed(1);
            
            return `
                <div class="product-item" id="product-${product.id}">
                    <div class="product-header">
                        <div class="product-name">${product.name}</div>
                        <div class="product-category ${product.category}">${this.getProductCategoryName(product.category)}</div>
                    </div>
                    <div class="product-details">
                        <div><strong>説明:</strong> ${product.description}</div>
                        <div class="product-usage-info">
                            <div>🏪 <strong>店舗:</strong> コース提供のみ（単品販売なし）</div>
                            <div>🚚 <strong>移動販売:</strong> 単品 ¥${product.price.toLocaleString()}</div>
                        </div>
                        <div class="product-specs">
                            <div><strong>原価:</strong> ¥${product.cost.toLocaleString()}</div>
                            <div><strong>移動販売利益:</strong> ¥${profit.toLocaleString()} (${profitMargin}%)</div>
                            ${product.craftYield ? `<div><strong>完成数:</strong> ${product.craftYield}個</div>` : ''}
                            ${product.totalMaterialCost ? `<div><strong>総素材コスト:</strong> ¥${product.totalMaterialCost.toLocaleString()}</div>` : ''}
                        </div>
                        ${product.materials ? `<div><strong>必要素材:</strong> ${product.materials}</div>` : ''}
                    </div>
                    <div class="management-buttons">
                        <button class="btn btn-secondary" onclick="rushLounge.editProduct(${product.id})">編集</button>
                        <button class="btn btn-danger" onclick="rushLounge.deleteRecord('products', ${product.id})">削除</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // 素材管理表示の更新
    updateMaterialManagementDisplay() {
        const container = document.getElementById('material-management-list');
        
        if (Object.keys(this.data.materialHistory).length === 0) {
            container.innerHTML = '<div class="empty-state">登録された素材がありません</div>';
            return;
        }
        
        const html = Object.entries(this.data.materialHistory).map(([name, price]) => {
            return `
                <div class="material-item" id="material-${name}">
                    <div class="product-header">
                        <div class="product-name">${name}</div>
                        <div class="product-category other">素材</div>
                    </div>
                    <div class="product-details">
                        <div><strong>仕入れ価格:</strong> ¥${price.toLocaleString()}</div>
                        <div><strong>単位:</strong> 1個</div>
                    </div>
                    <div class="management-buttons">
                        <button class="btn btn-secondary" onclick="rushLounge.editMaterial('${name}')">編集</button>
                        <button class="btn btn-danger" onclick="rushLounge.deleteMaterial('${name}')">削除</button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }

    // コース編集
    editCourse(id) {
        const course = this.data.courses.find(c => c.id === id);
        if (!course) {
            this.showAlert('コースが見つかりません', 'error');
            return;
        }

        const container = document.getElementById(`course-${id}`);
        const originalHtml = container.innerHTML;

        // 商品選択肢の生成
        const productOptions = this.data.products.map(product => 
            `<option value="${product.id}">${product.name} (¥${product.cost.toLocaleString()})</option>`
        ).join('');

        // 現在の構成商品を取得
        const currentProducts = course.products || [];
        const product1 = currentProducts[0] || '';
        const product2 = currentProducts[1] || '';
        const product3 = currentProducts[2] || '';

        container.innerHTML = `
            <form class="edit-form" onsubmit="rushLounge.saveCourseEdit(event, ${id})">
                <div class="form-group">
                    <label>コース名:</label>
                    <input type="text" name="name" value="${course.name}" required>
                </div>
                <div class="form-group">
                    <label>販売価格 (円):</label>
                    <input type="number" name="price" value="${course.price}" min="0" required onchange="rushLounge.updateEditCourseCalculation(${id})">
                </div>
                
                <div class="form-group">
                    <label>構成商品選択（3品）:</label>
                    <div class="course-product-selector">
                        <div class="product-selection-item">
                            <label>1品目:</label>
                            <select name="product1" id="edit-course-product-1-${id}" onchange="rushLounge.updateEditCourseCalculation(${id})">
                                <option value="">商品を選択してください</option>
                                <optgroup label="登録商品">
                                    ${productOptions}
                                </optgroup>
                                <optgroup label="日替わりメニュー">
                                    <option value="daily-menu" ${product1 === 'daily-menu' ? 'selected' : ''}>日替わりメニュー（設定日の商品構成）</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="product-selection-item">
                            <label>2品目:</label>
                            <select name="product2" id="edit-course-product-2-${id}" onchange="rushLounge.updateEditCourseCalculation(${id})">
                                <option value="">商品を選択してください</option>
                                <optgroup label="登録商品">
                                    ${productOptions}
                                </optgroup>
                                <optgroup label="日替わりメニュー">
                                    <option value="daily-menu" ${product2 === 'daily-menu' ? 'selected' : ''}>日替わりメニュー（設定日の商品構成）</option>
                                </optgroup>
                            </select>
                        </div>
                        <div class="product-selection-item">
                            <label>3品目:</label>
                            <select name="product3" id="edit-course-product-3-${id}" onchange="rushLounge.updateEditCourseCalculation(${id})">
                                <option value="">商品を選択してください</option>
                                <optgroup label="登録商品">
                                    ${productOptions}
                                </optgroup>
                                <optgroup label="日替わりメニュー">
                                    <option value="daily-menu" ${product3 === 'daily-menu' ? 'selected' : ''}>日替わりメニュー（設定日の商品構成）</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <div class="course-calculation-summary">
                        <div><strong>選択された商品:</strong> <span id="edit-selected-course-products-${id}">なし</span></div>
                        <div><strong>自動計算原価:</strong> <span id="edit-calculated-course-cost-${id}">¥0</span></div>
                        <div><strong>予想利益:</strong> <span id="edit-estimated-course-profit-${id}">¥0</span></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>原価 (円):</label>
                    <input type="number" name="cost" id="edit-course-cost-${id}" value="${course.cost}" min="0" readonly>
                    <small>※ 商品選択で自動計算されます</small>
                </div>
                <div class="form-group">
                    <label>コース内容:</label>
                    <textarea name="description" id="edit-course-description-${id}" rows="3">${course.description || ''}</textarea>
                    <small>※ 商品選択で自動生成されます</small>
                </div>
                <div class="form-group">
                    <label>使用食材:</label>
                    <textarea name="ingredients" id="edit-course-ingredients-${id}" rows="3">${course.ingredients || ''}</textarea>
                    <small>※ 商品選択で自動生成されます</small>
                </div>
                <div class="management-buttons">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="rushLounge.cancelEdit('course-${id}', \`${originalHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">キャンセル</button>
                </div>
            </form>
        `;

        // 現在の商品を選択状態にする
        setTimeout(() => {
            if (product1 && product1 !== 'daily-menu') {
                document.getElementById(`edit-course-product-1-${id}`).value = product1;
            }
            if (product2 && product2 !== 'daily-menu') {
                document.getElementById(`edit-course-product-2-${id}`).value = product2;
            }
            if (product3 && product3 !== 'daily-menu') {
                document.getElementById(`edit-course-product-3-${id}`).value = product3;
            }
            this.updateEditCourseCalculation(id);
        }, 100);
    }

    // コース編集時の計算更新
    updateEditCourseCalculation(courseId) {
        const product1Id = document.getElementById(`edit-course-product-1-${courseId}`).value;
        const product2Id = document.getElementById(`edit-course-product-2-${courseId}`).value;
        const product3Id = document.getElementById(`edit-course-product-3-${courseId}`).value;
        const coursePriceInput = document.querySelector(`#course-${courseId} input[name="price"]`);
        const coursePrice = parseInt(coursePriceInput?.value) || 0;

        // 選択された商品を取得（日替わりメニュー対応）
        const selectedProducts = [];
        const selectedProductNames = [];
        let totalCost = 0;
        
        [product1Id, product2Id, product3Id].forEach(id => {
            if (id === 'daily-menu') {
                selectedProductNames.push('日替わりメニュー');
                totalCost += 12500; // 日替わりメニューの想定原価
            } else if (id) {
                const product = this.data.products.find(p => p.id == id);
                if (product) {
                    selectedProducts.push(product);
                    selectedProductNames.push(product.name);
                    totalCost += product.cost;
                }
            }
        });

        // 選択商品の表示
        const selectedProductsDisplay = document.getElementById(`edit-selected-course-products-${courseId}`);
        if (selectedProductNames.length === 0) {
            selectedProductsDisplay.textContent = 'なし';
        } else {
            selectedProductsDisplay.textContent = selectedProductNames.join(', ');
        }

        // 原価計算
        document.getElementById(`edit-calculated-course-cost-${courseId}`).textContent = `¥${totalCost.toLocaleString()}`;
        document.getElementById(`edit-course-cost-${courseId}`).value = totalCost;

        // 利益計算
        const profit = coursePrice - totalCost;
        const profitDisplay = document.getElementById(`edit-estimated-course-profit-${courseId}`);
        profitDisplay.textContent = `¥${profit.toLocaleString()}`;

        // コース内容の自動生成
        const descriptions = [];
        selectedProducts.forEach(p => descriptions.push(`${p.name}: ${p.description}`));
        if (selectedProductNames.includes('日替わりメニュー')) {
            descriptions.push('日替わりメニュー: その日設定されたメニュー構成');
        }
        
        if (descriptions.length > 0) {
            document.getElementById(`edit-course-description-${courseId}`).value = descriptions.join('\n');
        }

        // 使用食材の自動生成
        if (selectedProducts.length > 0) {
            const materialsSet = new Set();
            selectedProducts.forEach(product => {
                if (product.materials) {
                    product.materials.forEach(material => {
                        materialsSet.add(`${material.name} x${material.quantity}`);
                    });
                }
            });
            
            if (selectedProductNames.includes('日替わりメニュー')) {
                materialsSet.add('日替わりメニュー用食材');
            }
            
            document.getElementById(`edit-course-ingredients-${courseId}`).value = Array.from(materialsSet).join(', ');
        }
    }

    // 商品編集
    editProduct(id) {
        const product = this.data.products.find(p => p.id === id);
        if (!product) {
            this.showAlert('商品が見つかりません', 'error');
            return;
        }

        const container = document.getElementById(`product-${id}`);
        const originalHtml = container.innerHTML;

        // 素材選択UIの生成
        const materialSelector = this.generateMaterialSelectorForEdit(product.materials || []);

        container.innerHTML = `
            <form class="edit-form" onsubmit="rushLounge.saveProductEdit(event, ${id})">
                <div class="form-group">
                    <label>商品名:</label>
                    <input type="text" name="name" value="${product.name}" required>
                </div>
                <div class="form-group">
                    <label>商品カテゴリ:</label>
                    <select name="category" required>
                        <option value="cocktail" ${product.category === 'cocktail' ? 'selected' : ''}>カクテル</option>
                        <option value="dish" ${product.category === 'dish' ? 'selected' : ''}>料理</option>
                        <option value="other" ${product.category === 'other' ? 'selected' : ''}>その他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>移動販売価格 (円):</label>
                    <input type="number" name="price" value="10000" readonly>
                    <small>※ 移動販売では全商品一律¥10,000で取引されます</small>
                </div>
                <div class="form-group">
                    <label>商品説明:</label>
                    <textarea name="description" rows="4" placeholder="商品の説明（任意）">${product.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>必要素材選択:</label>
                    <div id="edit-material-selector-${id}" class="material-selector">
                        ${materialSelector}
                    </div>
                    <div class="material-summary">
                        <div><strong>選択された素材:</strong> <span id="edit-selected-materials-text-${id}">なし</span></div>
                        <div><strong>総素材コスト:</strong> <span id="edit-total-material-cost-${id}">¥0</span></div>
                    </div>
                </div>
                <div class="form-group">
                    <label>完成数:</label>
                    <input type="number" id="edit-product-craft-yield-${id}" name="craftYield" value="${product.craftYield || 6}" min="1" placeholder="1回のクラフトで作れる数" onchange="rushLounge.calculateEditProductCost(${id})">
                </div>
                <div class="form-group">
                    <label>自動計算原価 (円):</label>
                    <input type="number" id="edit-product-cost-${id}" name="cost" readonly placeholder="素材コストと完成数から自動計算">
                    <small>※ 総素材コスト ÷ 完成数 で自動計算されます</small>
                </div>
                <div class="management-buttons">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="rushLounge.cancelEdit('product-${id}', \`${originalHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">キャンセル</button>
                </div>
            </form>
        `;

        // 初期計算
        setTimeout(() => {
            this.calculateEditProductCost(id);
        }, 100);
    }

    // 編集用素材セレクターの生成
    generateMaterialSelectorForEdit(selectedMaterials) {
        const materialEntries = Object.entries(this.data.materialHistory);
        if (materialEntries.length === 0) {
            return '<div class="alert alert-info"><p>登録された素材がありません。先に素材を登録してください。</p></div>';
        }

        return materialEntries.map(([name, price]) => {
            const existing = selectedMaterials.find(m => m.name === name);
            const isChecked = existing ? 'checked' : '';
            const quantity = existing ? existing.quantity : 1;
            
            return `
                <div class="material-item">
                    <input type="checkbox" id="edit-material-${name}" name="materials" value="${name}" ${isChecked} 
                           onchange="rushLounge.updateEditMaterialSelection()">
                    <div class="material-info">
                        <div class="material-name">${name}</div>
                        <div class="material-price">¥${price.toLocaleString()}</div>
                    </div>
                    <input type="number" class="material-quantity" value="${quantity}" min="1" 
                           onchange="rushLounge.updateEditMaterialSelection()" data-material="${name}">
                </div>
            `;
        }).join('');
    }

    // 編集時の素材選択更新
    updateEditMaterialSelection() {
        // 現在編集中の商品IDを特定
        const editForm = document.querySelector('.edit-form');
        if (!editForm) return;
        
        const productId = editForm.getAttribute('onsubmit').match(/saveProductEdit\(event, (\d+)\)/)?.[1];
        if (!productId) return;

        const checkedMaterials = Array.from(document.querySelectorAll(`#edit-material-selector-${productId} input[name="materials"]:checked`));
        const selectedMaterials = [];
        let totalCost = 0;

        checkedMaterials.forEach(checkbox => {
            const materialName = checkbox.value;
            const quantityInput = document.querySelector(`#edit-material-selector-${productId} input[data-material="${materialName}"]`);
            const quantity = parseInt(quantityInput.value) || 1;
            const price = this.data.materialHistory[materialName] || 0;
            
            selectedMaterials.push(materialName + ` x${quantity}`);
            totalCost += price * quantity;
        });

        // 表示更新
        const selectedText = document.getElementById(`edit-selected-materials-text-${productId}`);
        const totalCostText = document.getElementById(`edit-total-material-cost-${productId}`);
        
        if (selectedText) {
            selectedText.textContent = selectedMaterials.length > 0 ? selectedMaterials.join(', ') : 'なし';
        }
        if (totalCostText) {
            totalCostText.textContent = `¥${totalCost.toLocaleString()}`;
        }

        // 原価計算の更新
        this.calculateEditProductCost(productId);
    }

    // 編集時の商品原価計算
    calculateEditProductCost(productId) {
        const checkedMaterials = Array.from(document.querySelectorAll(`#edit-material-selector-${productId} input[name="materials"]:checked`));
        let totalMaterialCost = 0;

        checkedMaterials.forEach(checkbox => {
            const materialName = checkbox.value;
            const quantityInput = document.querySelector(`#edit-material-selector-${productId} input[data-material="${materialName}"]`);
            const quantity = parseInt(quantityInput.value) || 1;
            const price = this.data.materialHistory[materialName] || 0;
            totalMaterialCost += price * quantity;
        });

        const craftYield = parseInt(document.getElementById(`edit-product-craft-yield-${productId}`)?.value) || 1;
        const unitCost = Math.ceil(totalMaterialCost / craftYield);
        
        const costInput = document.getElementById(`edit-product-cost-${productId}`);
        if (costInput) {
            costInput.value = unitCost;
        }
    }

    // コース編集保存
    saveCourseEdit(event, id) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const courseIndex = this.data.courses.findIndex(c => c.id === id);
        if (courseIndex === -1) {
            this.showAlert('コースが見つかりません', 'error');
            return;
        }

        // 構成商品を取得
        const products = [
            formData.get('product1'),
            formData.get('product2'),
            formData.get('product3')
        ].filter(p => p);

        this.data.courses[courseIndex] = {
            ...this.data.courses[courseIndex],
            name: formData.get('name'),
            price: parseInt(formData.get('price')),
            cost: parseInt(formData.get('cost')),
            description: formData.get('description'),
            ingredients: formData.get('ingredients'),
            products: products // 構成商品を保存
        };

        this.saveData();
        this.updateCourseManagementDisplay();
        this.updateCourseDisplay(); // 新規コースタブの表示も更新
        this.updateMenuTypeSelector(); // メニュータイプ選択肢も更新
        this.updateDailyMenuPriceDisplay(); // 日替わりメニュー価格も更新
        this.showAlert('コースが更新されました', 'success');
    }

    // 商品編集保存
    saveProductEdit(event, id) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);

        const productIndex = this.data.products.findIndex(p => p.id === id);
        if (productIndex === -1) {
            this.showAlert('商品が見つかりません', 'error');
            return;
        }

        // 選択された素材を取得
        const checkedMaterials = Array.from(document.querySelectorAll(`#edit-material-selector-${id} input[name="materials"]:checked`));
        const materials = checkedMaterials.map(checkbox => {
            const materialName = checkbox.value;
            const quantityInput = document.querySelector(`#edit-material-selector-${id} input[data-material="${materialName}"]`);
            const quantity = parseInt(quantityInput.value) || 1;
            return {
                name: materialName,
                quantity: quantity,
                price: this.data.materialHistory[materialName] || 0
            };
        });

        // 総素材コストを計算
        const totalMaterialCost = materials.reduce((sum, material) => sum + (material.price * material.quantity), 0);

        this.data.products[productIndex] = {
            ...this.data.products[productIndex],
            name: formData.get('name'),
            category: formData.get('category'),
            price: 10000, // 移動販売固定価格
            cost: parseInt(formData.get('cost')),
            description: formData.get('description'),
            materials: materials, // 構造化された素材データ
            craftYield: formData.get('craftYield') ? parseInt(formData.get('craftYield')) : 6,
            totalMaterialCost: totalMaterialCost
        };

        this.saveData();
        this.updateProductManagementDisplay();
        this.updateProductDisplay(); // 新規商品タブの表示も更新
        this.updateDailyMenuProductSelector(); // 日替わりメニュー商品選択肢も更新
        this.initializeCourseProductSelector(); // コース商品選択肢も更新
        this.showAlert('商品が更新されました', 'success');
    }

    // 編集キャンセル
    cancelEdit(elementId, originalHtml) {
        document.getElementById(elementId).innerHTML = originalHtml;
    }

    // 素材編集
    editMaterial(name) {
        const price = this.data.materialHistory[name];
        if (price === undefined) {
            this.showAlert('素材が見つかりません', 'error');
            return;
        }

        const container = document.getElementById(`material-${name}`);
        const originalHtml = container.innerHTML;

        container.innerHTML = `
            <form class="edit-form" onsubmit="rushLounge.saveMaterialEdit(event, '${name}')">
                <div class="form-group">
                    <label>素材名:</label>
                    <input type="text" name="name" value="${name}" required>
                </div>
                <div class="form-group">
                    <label>仕入れ価格 (円):</label>
                    <input type="number" name="price" value="${price}" min="0" required>
                </div>
                <div class="management-buttons">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="rushLounge.cancelEdit('material-${name}', \`${originalHtml.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)">キャンセル</button>
                </div>
            </form>
        `;
    }

    // 素材編集保存
    saveMaterialEdit(event, oldName) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const newName = formData.get('name');
        const newPrice = parseInt(formData.get('price'));

        // 名前が変更された場合、重複チェック
        if (newName !== oldName && this.data.materialHistory[newName]) {
            this.showAlert('この素材名は既に存在します', 'error');
            return;
        }

        // 古い素材を削除（名前が変更された場合）
        if (newName !== oldName) {
            delete this.data.materialHistory[oldName];
        }
        
        // 新しい素材を追加/更新
        this.data.materialHistory[newName] = newPrice;

        this.saveData();
        this.updateMaterialDisplay();
        this.updateMaterialManagementDisplay();
        this.setupMaterialSelector(); // 商品作成時の素材選択UIを更新
        this.showAlert('素材が更新されました', 'success');
    }

    // 素材削除
    deleteMaterial(name) {
        if (confirm(`素材「${name}」を削除しますか？\n※既存の商品で使用されている場合は影響を受ける可能性があります`)) {
            delete this.data.materialHistory[name];

            this.saveData();
            this.updateMaterialDisplay();
            this.updateMaterialManagementDisplay();
            this.setupMaterialSelector(); // 商品作成時の素材選択UIを更新
            this.showAlert('素材が削除されました', 'success');
        }
    }

    // 素材選択UIのセットアップ
    setupMaterialSelector() {
        const container = document.getElementById('material-selector');
        if (!container) return;

        const html = Object.entries(this.data.materialHistory).map(([name, price]) => `
            <div class="material-item">
                <input type="checkbox" id="material-${name}" onchange="rushLounge.updateMaterialSelection()">
                <div class="material-info">
                    <div class="material-name">${name}</div>
                    <div class="material-price">¥${price.toLocaleString()}</div>
                </div>
                <input type="number" class="material-quantity" id="quantity-${name}" min="1" value="1" 
                       onchange="rushLounge.updateMaterialSelection()" disabled>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // 素材選択の更新
    updateMaterialSelection() {
        const selectedMaterials = [];
        let totalCost = 0;

        Object.keys(this.data.materialHistory).forEach(materialName => {
            const checkbox = document.getElementById(`material-${materialName}`);
            const quantityInput = document.getElementById(`quantity-${materialName}`);
            
            if (checkbox && checkbox.checked) {
                const quantity = parseInt(quantityInput.value) || 1;
                const price = this.data.materialHistory[materialName];
                const cost = price * quantity;
                
                selectedMaterials.push(`${materialName}*${quantity}(¥${price.toLocaleString()})`);
                totalCost += cost;
                
                quantityInput.disabled = false;
            } else if (quantityInput) {
                quantityInput.disabled = true;
                quantityInput.value = 1;
            }
        });

        // 選択素材テキストの更新
        const selectedText = selectedMaterials.length > 0 ? selectedMaterials.join('、') : 'なし';
        document.getElementById('selected-materials-text').textContent = selectedText;
        
        // 総コスト表示の更新
        document.getElementById('total-material-cost').textContent = `¥${totalCost.toLocaleString()}`;
        
        // 原価計算の更新
        this.calculateProductCost();
    }

    // 商品原価の計算
    calculateProductCost() {
        const totalCostText = document.getElementById('total-material-cost').textContent;
        const totalCost = parseInt(totalCostText.replace(/[¥,]/g, '')) || 0;
        const craftYield = parseInt(document.getElementById('product-craft-yield').value) || 1;
        
        const costPerUnit = Math.ceil(totalCost / craftYield);
        document.getElementById('product-cost').value = costPerUnit;
    }

    // 素材選択のリセット
    resetMaterialSelector() {
        Object.keys(this.materials).forEach(materialName => {
            const checkbox = document.getElementById(`material-${materialName}`);
            const quantityInput = document.getElementById(`quantity-${materialName}`);
            
            if (checkbox) {
                checkbox.checked = false;
            }
            if (quantityInput) {
                quantityInput.disabled = true;
                quantityInput.value = 1;
            }
        });
        
        document.getElementById('selected-materials-text').textContent = 'なし';
        document.getElementById('total-material-cost').textContent = '¥0';
        document.getElementById('product-cost').value = '';
    }

    // タブ表示の更新
    updateTabDisplay(tabName) {
        switch (tabName) {
            case 'attendance':
                this.updateAttendanceDisplay();
                this.updateAttendanceCalendar();
                break;
            case 'daily-menu':
                this.updateCurrentDailyMenu();
                this.updateDailyMenuDisplay();
                this.updateDailyMenuConfigDisplay();
                this.updateDailyMenuPriceDisplay();
                break;
            case 'regular-menu':
                this.updateRegularMenuDisplay();
                break;
            case 'other-revenue':
                this.updateOtherRevenueDisplay();
                break;
            case 'sales-summary':
                this.updateSalesStats();
                break;
            case 'financial':
                this.updateExpenseDisplay();
                this.updateFinancialStats();
                break;
            case 'vault':
                this.updateVaultDisplay();
                break;
            case 'weekly-attendance':
                this.updateWeeklyCalendar();
                this.calculateCurrentWeekStats();
                break;
            case 'course-product':
                this.updateCourseDisplay();
                this.updateProductDisplay();
                this.updateCourseManagementDisplay();
                this.updateProductManagementDisplay();
                this.setupMaterialSelector();
                this.updateDailyMenuPriceDisplay(); // 日替わりメニュー価格も更新
                break;
            case 'data-import':
                this.updateDataStatistics();
                this.updateEmployeeDisplay();
                this.setupRealTimeSave();
                setTimeout(() => {
                    this.loadSavedUrls();
                }, 100);
                break;
        }
    }

    // すべての表示を更新
    updateAllDisplays() {
        this.updateAttendanceDisplay();
        this.updateCurrentDailyMenu();
        this.updateDailyMenuDisplay();
        this.updateDailyMenuConfigDisplay();
        this.updateDailyMenuPriceDisplay();
        this.updateRegularMenuDisplay();
        this.updateRegularMenuStats(); // その他メニュー統計を追加
        this.updateOtherRevenueDisplay();
        this.updateExpenseDisplay();
        this.updateVaultDisplay();
        this.updateCourseDisplay();
        this.updateProductDisplay();
        this.updateCourseManagementDisplay();
        this.updateProductManagementDisplay();
        this.updateMaterialManagementDisplay();
        this.updateMenuTypeSelector(); // メニュータイプ選択肢も更新
        this.updateDailyMenuProductSelector(); // 日替わりメニュー商品選択肢も更新
        this.initializeCourseProductSelector(); // コース商品選択肢も更新
        this.updateSalesStats();
        this.updateFinancialStats();
        this.updateDataStatistics();
        this.updateEmployeeDisplay();
        this.updateEmployeeSelectors();
        
        // ボーナス計算も自動実行
        this.calculateCurrentWeekStats();
    }

    // ユーティリティ関数
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // 日付時刻文字列から日付部分のみを抽出（YYYY-MM-DD形式）
    extractDateFromDateTime(dateTimeString) {
        if (!dateTimeString) return null;
        
        // ISO形式の日付時刻文字列の場合（例: 2024-01-01T09:00:00）
        if (dateTimeString.includes('T')) {
            return dateTimeString.split('T')[0];
        }
        
        // 既に日付のみの場合（例: 2024-01-01）
        if (dateTimeString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateTimeString;
        }
        
        // Date オブジェクトに変換して日付部分を抽出
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) return null;
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDateTime(dateTimeString) {
        const date = new Date(dateTimeString);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getShiftTypeName(type) {
        const types = {
            'morning': '朝シフト',
            'afternoon': '昼シフト',
            'evening': '夜シフト',
            'late-night': '深夜シフト'
        };
        return types[type] || type;
    }

    getMenuTypeName(type) {
        // 登録済みコースかどうかチェック
        if (type && type.startsWith('course-')) {
            const courseId = parseInt(type.replace('course-', ''));
            const course = this.data.courses.find(c => c.id === courseId);
            if (course) {
                return course.name;
            }
        }
        
        return type;
    }

    getRevenueTypeName(type) {
        const types = {
            'mobile-sales': '移動販売',
            'event': 'イベント',
            'catering': 'ケータリング',
            'other': 'その他'
        };
        return types[type] || type;
    }

    getExpenseCategoryName(category) {
        const categories = {
            'ingredients': '食材',
            'alcohol': 'アルコール',
            'supplies': '備品',
            'other': 'その他'
        };
        return categories[category] || category;
    }

    getProductCategoryName(category) {
        const categories = {
            'cocktail': 'カクテル',
            'dish': '料理',
            'other': 'その他'
        };
        return categories[category] || category;
    }



    // アラート表示
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        
        document.body.insertBefore(alert, document.body.firstChild);
        
        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    // ========== Firebase共有機能 ==========

    // Firebase初期化
    initializeFirebase() {
        try {
            this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            this.database = firebase.database();
            console.log('Firebase初期化完了');
        } catch (error) {
            console.error('Firebase初期化エラー:', error);
            this.showAlert('Firebase初期化に失敗しました', 'error');
        }
    }

    // 店舗接続機能の初期化（自動接続）
    setupStoreConnection() {
        // 常に自動接続
        this.connectToStore(true);
        this.updateConnectionStatus();
    }

    // 店舗に接続
    async connectToStore(auto = false) {
        if (!this.database) {
            this.showAlert('Firebaseが初期化されていません', 'error');
            return;
        }

        try {
            // オンライン状態を記録
            const userRef = this.database.ref(`stores/${this.storeCode}/users/${Date.now()}`);
            await userRef.set({
                connected: true,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            // 切断時にユーザーを削除
            userRef.onDisconnect().remove();
            
            // データ同期の開始
            this.startDataSync();
            
            // 接続状態を更新
            this.isOnline = true;
            this.updateConnectionStatus();
            
            if (!auto) {
                this.showAlert('共有機能に接続しました', 'success');
            }
            
        } catch (error) {
            console.error('店舗接続エラー:', error);
            this.showAlert('共有機能の接続に失敗しました', 'error');
            this.isOnline = false;
            this.updateConnectionStatus();
        }
    }



    // データ同期の開始
    startDataSync() {
        if (!this.database || !this.storeCode) return;

        const storeRef = this.database.ref(`stores/${this.storeCode}/data`);
        
        // 初回データ読み込み
        storeRef.once('value').then((snapshot) => {
            const sharedData = snapshot.val();
            if (sharedData) {
                // 共有データをローカルデータにマージ
                this.mergeSharedData(sharedData);
            } else {
                // 初回の場合は現在のデータをアップロード
                this.uploadCurrentData();
            }
        });

        // リアルタイム同期（デバウンス付き）
        this.listeners.dataSync = storeRef.on('value', (snapshot) => {
            const sharedData = snapshot.val();
            if (sharedData) {
                // 同期の頻度制御
                this.debouncedMergeSharedData(sharedData);
            }
        });

        // オンラインユーザー数の監視
        const usersRef = this.database.ref(`stores/${this.storeCode}/users`);
        this.listeners.userCount = usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            this.onlineUsers = users ? Object.keys(users).length : 0;
            this.updateConnectionStatus();
        });
    }

    // データ同期の停止
    stopDataSync() {
        if (!this.database || !this.storeCode) return;

        Object.values(this.listeners).forEach(listener => {
            if (listener) {
                this.database.ref(`stores/${this.storeCode}/data`).off('value', listener);
                this.database.ref(`stores/${this.storeCode}/users`).off('value', listener);
            }
        });
        
        this.listeners = {};
    }

    // 共有データのマージ（デバウンス付き）
    debouncedMergeSharedData(sharedData) {
        // フォーム操作中は同期を遅延
        if (this.isAnyFormInUse()) {
            console.log('⏳ フォーム使用中のため同期を遅延します');
            clearTimeout(this.mergeTimeout);
            this.mergeTimeout = setTimeout(() => {
                this.mergeSharedData(sharedData);
            }, 2000); // 2秒後に実行
            return;
        }

        // 前回の同期から短時間の場合は遅延
        const now = Date.now();
        const timeSinceLastMerge = now - (this.lastMergeTime || 0);
        
        if (timeSinceLastMerge < 1000) { // 1秒以内
            console.log('⏳ 同期頻度制御により遅延します');
            clearTimeout(this.mergeTimeout);
            this.mergeTimeout = setTimeout(() => {
                this.mergeSharedData(sharedData);
            }, 1000);
            return;
        }

        // 即座に実行
        this.mergeSharedData(sharedData);
    }

    // フォームが使用中かどうかを確認
    isAnyFormInUse() {
        const protectedSelectors = ['#quick-employee-name'];
        
        return protectedSelectors.some(selector => {
            const element = document.querySelector(selector);
            return element && this.isFormElementInUse(element);
        });
    }

    // 共有データのマージ
    mergeSharedData(sharedData) {
        if (!sharedData) return;

        console.log('🔄 Firebase同期: データマージを開始');
        this.lastMergeTime = Date.now();

        // 削除記録をマージ
        if (sharedData.deletedRecords) {
            if (!this.data.deletedRecords) {
                this.data.deletedRecords = {};
            }
            Object.keys(sharedData.deletedRecords).forEach(category => {
                if (!this.data.deletedRecords[category]) {
                    this.data.deletedRecords[category] = [];
                }
                // 削除記録をマージ（重複除去）
                const existingDeletedIds = this.data.deletedRecords[category].map(d => d.id);
                sharedData.deletedRecords[category].forEach(deletedRecord => {
                    if (!existingDeletedIds.includes(deletedRecord.id)) {
                        this.data.deletedRecords[category].push(deletedRecord);
                    }
                });
            });
        }

        // タイムスタンプベースでのマージ（削除記録を考慮）
        Object.keys(sharedData).forEach(key => {
            if (Array.isArray(sharedData[key])) {
                this.data[key] = this.mergeArrayDataWithDeleted(this.data[key] || [], sharedData[key], key);
            } else if (key !== 'deletedRecords') {
                this.data[key] = sharedData[key];
            }
        });
        
        // ローカルストレージにも保存
        localStorage.setItem('rushLoungeData', JSON.stringify(this.data));
        
        // 表示を更新（フォーム保護を考慮）
        this.updateAllDisplaysCarefully();
        
        console.log('✅ Firebase同期: データマージ完了');
    }

    // フォーム保護を考慮した表示更新
    updateAllDisplaysCarefully() {
        // フォーム使用中は表示更新を制限
        if (this.isAnyFormInUse()) {
            console.log('🔒 フォーム使用中のため表示更新を制限');
            // 重要でない表示のみ更新
            this.updateSalesStats();
            this.updateFinancialStats();
            return;
        }

        // 通常の表示更新
        this.updateAllDisplays();
    }

    // 配列データのマージ（IDベース）
    mergeArrayData(localData, sharedData) {
        const merged = [...localData];
        
        sharedData.forEach(sharedItem => {
            const existingIndex = merged.findIndex(item => item.id === sharedItem.id);
            if (existingIndex >= 0) {
                // 既存アイテムがある場合は更新（timestampで比較）
                const existingItem = merged[existingIndex];
                if (!existingItem.timestamp || 
                    (sharedItem.timestamp && new Date(sharedItem.timestamp) > new Date(existingItem.timestamp))) {
                    merged[existingIndex] = sharedItem;
                }
            } else {
                // 新しいアイテムの場合は追加
                merged.push(sharedItem);
            }
        });
        
        return merged;
    }

    // 削除記録を考慮した配列データのマージ
    mergeArrayDataWithDeleted(localData, sharedData, category) {
        const merged = [...localData];
        
        // 削除記録を取得
        const deletedRecords = this.data.deletedRecords && this.data.deletedRecords[category] 
            ? this.data.deletedRecords[category] : [];
        const deletedIds = deletedRecords.map(d => d.id);
        
        // 共有データから削除済みでないアイテムのみを処理
        sharedData.forEach(sharedItem => {
            // 削除済みかチェック
            if (deletedIds.includes(sharedItem.id)) {
                console.log(`🗑️ 削除済みアイテムをスキップ: ${category}[${sharedItem.id}]`);
                return;
            }
            
            const existingIndex = merged.findIndex(item => item.id === sharedItem.id);
            if (existingIndex >= 0) {
                // 既存アイテムがある場合は更新（timestampで比較）
                const existingItem = merged[existingIndex];
                if (!existingItem.timestamp || 
                    (sharedItem.timestamp && new Date(sharedItem.timestamp) > new Date(existingItem.timestamp))) {
                    merged[existingIndex] = sharedItem;
                }
            } else {
                // 新しいアイテムの場合は追加
                merged.push(sharedItem);
            }
        });
        
        // ローカルデータからも削除済みアイテムを除去
        const finalMerged = merged.filter(item => !deletedIds.includes(item.id));
        
        return finalMerged;
    }

    // 現在のデータをアップロード
    async uploadCurrentData() {
        if (!this.database || !this.storeCode) return;

        try {
            const storeRef = this.database.ref(`stores/${this.storeCode}/data`);
            await storeRef.set(this.data);
        } catch (error) {
            console.error('データアップロードエラー:', error);
        }
    }

    // データが変更された時の共有データ更新
    saveData() {
        // ローカルストレージに保存
        localStorage.setItem('rushLoungeData', JSON.stringify(this.data));
        
        // オンラインの場合は共有データも更新
        if (this.isOnline && this.database && this.storeCode) {
            this.uploadCurrentData();
        }
    }

    // 接続状態の更新
    updateConnectionStatus() {
        const indicator = document.getElementById('connection-indicator');
        const text = document.getElementById('connection-text');
        const usersInfo = document.getElementById('online-users');

        if (this.isOnline) {
            indicator.className = 'indicator online';
            text.textContent = '同期中';
            usersInfo.textContent = `接続中: ${this.onlineUsers}人`;
        } else {
            indicator.className = 'indicator offline';
            text.textContent = '接続中...';
            usersInfo.textContent = '接続中: 1人';
        }
    }

    // ========== データインポート・エクスポート機能 ==========

    // データインポートリスナーの設定
    setupDataImportListeners() {
        const importTypes = [
            { id: 'attendance-import', type: 'attendance' },
            { id: 'daily-menu-import', type: 'daily-menu' },
            { id: 'regular-menu-import', type: 'regular-menu' },
            { id: 'other-revenue-import', type: 'other-revenue' },
            { id: 'expenses-import', type: 'expense' },  // HTMLファイルに合わせて修正
            { id: 'vault-import', type: 'vault' }
        ];

        console.log('🔧 データインポートリスナーの設定を開始...');
        
        importTypes.forEach(({ id, type }) => {
            const fileInput = document.getElementById(id);
            if (fileInput) {
                // 既存のリスナーを削除してから新しいリスナーを追加
                if (fileInput._importHandler) {
                    fileInput.removeEventListener('change', fileInput._importHandler);
                }
                
                fileInput._importHandler = (e) => {
                    console.log(`📁 ファイル選択: ${type}, 要素ID: ${id}`);
                    this.handleFileImport(e, type);
                };
                
                fileInput.addEventListener('change', fileInput._importHandler);
                
                console.log(`✅ インポートリスナー設定完了: ${id} -> ${type}`);
            } else {
                console.error(`❌ インポート要素が見つかりません: ${id}`);
            }
        });
        
        console.log('🔧 データインポートリスナーの設定完了');
    }

    // ファイルインポートの処理
    async handleFileImport(event, dataType) {
        const file = event.target.files[0];
        if (!file) {
            console.log('❌ ファイルが選択されていません');
            return;
        }

        console.log(`🚀 インポート開始: ${dataType}, ファイル: ${file.name}, サイズ: ${file.size}バイト`);
        this.showAlert(`📂 ${file.name} を読み込み中...`, 'info');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvText = e.target.result;
                console.log(`📄 CSVテキスト長: ${csvText.length}文字`);
                console.log(`📄 CSVプレビュー:`, csvText.substring(0, 200) + '...');
                
                const result = this.parseCSVWithReport(csvText, dataType);
                console.log(`📊 解析結果:`, result);
                
                if (result.success) {
                    this.updateAllDisplays();
                    this.showDetailedImportAlert(result.report, dataType);
                    console.log(`✅ インポート完了: ${dataType}`);
                } else {
                    console.error(`❌ インポート失敗: ${result.error}`);
                    this.showAlert(`インポートエラー: ${result.error}`, 'error');
                }
            } catch (error) {
                console.error('💥 インポートエラー:', error);
                this.showAlert(`ファイルの読み込みに失敗しました: ${error.message}`, 'error');
            }
        };
        
        reader.onerror = (error) => {
            console.error('💥 ファイル読み込みエラー:', error);
            this.showAlert('ファイルの読み込みに失敗しました', 'error');
        };
        
        reader.readAsText(file, 'UTF-8');
        
        // ファイル選択をリセット
        event.target.value = '';
    }

    // デバッグ用：リスナー設定状況の確認
    debugImportListeners() {
        const importTypes = [
            'attendance-import', 'daily-menu-import', 'regular-menu-import',
            'other-revenue-import', 'expenses-import', 'vault-import'
        ];
        
        console.log('🔍 インポートリスナーのデバッグ情報:');
        
        importTypes.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`✅ 要素発見: ${id}`);
                console.log(`  - タイプ: ${element.type}`);
                console.log(`  - リスナー設定済み: ${element._importHandler ? 'Yes' : 'No'}`);
                
                // テスト用の一時的なchange イベントを発火
                if (element._importHandler) {
                    console.log(`  - リスナーテスト: 実行可能`);
                } else {
                    console.log(`  - リスナーテスト: 未設定`);
                }
            } else {
                console.error(`❌ 要素なし: ${id}`);
            }
        });
        
        return '詳細はコンソールを確認してください';
    }

    // CSVパースと詳細レポート
    parseCSVWithReport(csvText, dataType) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                return { success: false, error: 'CSVファイルにデータが含まれていません' };
            }

            // ヘッダー行を検出
            let headerLineIndex = 0;
            let headers = [];
            
            // 最初の行から最大3行まで検索してヘッダーを見つける
            for (let i = 0; i < Math.min(3, lines.length); i++) {
                const testHeaders = this.parseCSVLine(lines[i]);
                if (this.isHeaderLine(testHeaders, dataType)) {
                    headerLineIndex = i;
                    headers = testHeaders;
                    break;
                }
            }

            if (headers.length === 0) {
                return { success: false, error: 'ヘッダー行が見つかりません' };
            }

            // データ行を処理
            const dataLines = lines.slice(headerLineIndex + 1);
            const parsedData = [];
            const parseErrors = [];
            
            for (let i = 0; i < dataLines.length; i++) {
                const line = dataLines[i].trim();
                if (!line) continue;

                try {
                    const values = this.parseCSVLine(line);
                    if (values.length === 0) continue;

                    const item = this.convertCSVRowToDataAdvanced(headers, values, dataType);
                    
                    if (item) {
                        parsedData.push(item);
                    }
                } catch (error) {
                    parseErrors.push(`行 ${i + headerLineIndex + 2}: ${error.message}`);
                }
            }

            if (parsedData.length === 0) {
                return { 
                    success: false, 
                    error: '有効なデータが見つかりませんでした\n' + 
                           (parseErrors.length > 0 ? '解析エラー:\n' + parseErrors.join('\n') : '') 
                };
            }

            const mergeResult = this.mergeImportedDataWithReport(dataType, parsedData);
            
            return {
                success: true,
                report: this.createImportReport(
                    { 
                        total: parsedData.length, 
                        errors: parseErrors 
                    }, 
                    mergeResult, 
                    dataType
                )
            };

        } catch (error) {
            console.error('CSV解析エラー:', error);
            return { success: false, error: 'CSVファイルの解析に失敗しました: ' + error.message };
        }
    }

    // ヘッダー行の判定（修正版）
    isHeaderLine(headers, dataType) {
        console.log(`🔍 ヘッダー判定: ${dataType}`);
        console.log(`📋 受信ヘッダー:`, headers);
        
        const expectedHeaders = {
            'attendance': [
                // 基本的な組み合わせ
                ['日付', '従業員'], ['日付', 'スタッフ'], ['日付', '担当'],
                ['date', 'staff'], ['date', 'employee'], ['date', 'name'],
                // 単体でも許可（より柔軟に）
                ['日付'], ['従業員'], ['出勤'], ['attendance']
            ],
                         'daily-menu': [
                 // 基本的な組み合わせ
                 ['日付', '金額'], ['日付', '1品目'], ['日付', '商品1'], 
                 ['日付', '単価'], ['日付', '合計'], ['date', 'amount'],
                 // 単体でも許可
                 ['日付'], ['商品1'], ['商品2'], ['商品3'], ['1品目'], ['2品目'], ['3品目']
             ],
                         'regular-menu': [
                 // 基本的な組み合わせ
                 ['日付', 'メニュータイプ'], ['日付', 'メニュー名'], ['日付', 'コース'], 
                 ['日付', '金額'], ['日付', '単価'], ['日付', '合計'], ['date', 'course'],
                 // 単体でも許可
                 ['日付'], ['メニュータイプ'], ['メニュー名'], ['コース'], ['menuType'], ['course']
             ],
             'other-menu': [
                 // 基本的な組み合わせ
                 ['日付', 'メニュータイプ'], ['日付', 'メニュー名'], ['日付', 'コース'], 
                 ['日付', '金額'], ['日付', '単価'], ['日付', '合計'], ['date', 'course'],
                 // 単体でも許可
                 ['日付'], ['メニュータイプ'], ['メニュー名'], ['コース'], ['menuType'], ['course']
             ],
            'other-revenue': [
                ['日付', '金額'], ['date', 'amount'], ['日付'], ['金額']
            ],
            'expense': [
                ['日付', '金額'], ['date', 'amount'], ['日付'], ['支出']
            ],
            'vault': [
                ['日付', '金額'], ['date', 'amount'], ['日付'], ['金庫']
            ]
        };

        const possibleCombinations = expectedHeaders[dataType] || [['日付']];
        
        // 各組み合わせパターンをテスト
        for (const expectedPattern of possibleCombinations) {
            let matchCount = 0;
            
            for (const expectedHeader of expectedPattern) {
                const found = headers.some(header => {
                    const normalizedHeader = header.toLowerCase().trim();
                    const normalizedExpected = expectedHeader.toLowerCase();
                    
                    // より柔軟なマッチング
                    return normalizedHeader.includes(normalizedExpected) ||
                           normalizedExpected.includes(normalizedHeader) ||
                           this.isSimilarHeader(normalizedHeader, normalizedExpected);
                });
                
                if (found) {
                    matchCount++;
                }
            }
            
            // パターンの50%以上がマッチすればヘッダーと判定
            const requiredMatches = Math.max(1, Math.ceil(expectedPattern.length * 0.5));
            if (matchCount >= requiredMatches) {
                console.log(`✅ ヘッダー判定成功: パターン ${expectedPattern.join(',')} で ${matchCount}/${expectedPattern.length} マッチ`);
                return true;
            }
        }

        // 数値の割合チェック（フォールバック判定）
        const numericCount = headers.filter(header => {
            const trimmed = header.trim();
            return !isNaN(parseFloat(trimmed)) && isFinite(trimmed);
        }).length;
        
        const textRatio = (headers.length - numericCount) / headers.length;
        const isLikelyHeader = textRatio >= 0.7; // 70%以上が非数値ならヘッダーと判定
        
        console.log(`📊 フォールバック判定: 非数値率 ${(textRatio * 100).toFixed(1)}% ${isLikelyHeader ? '→ ヘッダー' : '→ データ行'}`);
        
        if (isLikelyHeader) {
            console.log(`✅ フォールバック判定でヘッダーと認定`);
        } else {
            console.log(`❌ ヘッダー判定失敗: 適切なパターンが見つかりません`);
        }
        
        return isLikelyHeader;
    }

    // ヘッダー類似性判定
    isSimilarHeader(header1, header2) {
        // 類似語判定
        const synonyms = {
            '日付': ['date', '年月日', '日時', '出勤日', '勤務日', '販売日', '提供日'],
            '従業員': ['employee', 'staff', 'スタッフ', '担当', '名前', 'name', '従業員名'],
            '金額': ['amount', '価格', '料金', '売上', '収益', '支出', '単価', '合計', 'total', 'price'],
            'コース': ['course', 'menu', 'メニュー', 'コース名', 'メニュー名'],
            'メニュータイプ': ['menutype', 'menu_type', 'type', 'タイプ', '種別', 'category'],
            'メニュー名': ['menu_name', 'menuname', 'course_name', 'coursename', 'name'],
            '時間': ['time', '時刻', '勤務時間'],
            'シフト': ['shift', 'シフト種別', '勤務形態'],
            '数量': ['quantity', 'qty', 'count', '個数', '提供数']
        };

        for (const [key, values] of Object.entries(synonyms)) {
            if ((header1.includes(key.toLowerCase()) || values.some(v => header1.includes(v))) &&
                (header2.includes(key.toLowerCase()) || values.some(v => header2.includes(v)))) {
                return true;
            }
        }

        return false;
    }

    // データ変換の改善
    convertCSVRowToDataAdvanced(headers, values, dataType) {
        const baseItem = {
            id: Date.now() + Math.random(),
            timestamp: new Date().toISOString()
        };
        
        const dataMap = {};
        
        // ヘッダーと値のマッピング
        headers.forEach((header, index) => {
            if (values[index] !== undefined && values[index] !== null) {
                dataMap[header] = values[index].toString().trim();
            }
        });

        // データタイプ別の処理
        switch (dataType) {
            case 'regular-menu':
            case 'other-menu':
                return this.convertRegularMenuData(dataMap, baseItem);
            case 'other-revenue':
                return this.convertOtherRevenueData(dataMap, baseItem);
            case 'attendance':
                return this.convertAttendanceData(dataMap, baseItem);
            case 'daily-menu':
                return this.convertDailyMenuData(dataMap, baseItem);
            case 'expense':
                return this.convertExpenseData(dataMap, baseItem);
            case 'vault':
                return this.convertVaultData(dataMap, baseItem);
            default:
                return null;
        }
    }

    // 通常メニューデータの変換（修正版）
    convertRegularMenuData(dataMap, baseItem) {
        console.log(`🔄 通常メニューデータ変換開始:`, dataMap);
        
        // より広範なフィールド名で検索
        const dateField = this.findFieldByNames(dataMap, [
            '日付', 'date', '提供日', '販売日', '年月日', '日時'
        ]);
        
        const menuTypeField = this.findFieldByNames(dataMap, [
            'メニュータイプ', 'menutype', 'menu_type', 'type', 'タイプ', '種別', 'category'
        ]);
        
        const courseField = this.findFieldByNames(dataMap, [
            'コース', 'コース名', 'メニュー', 'メニュー名', 'course', 'menu', 
            'menu_name', 'course_name', 'menuname', 'coursename'
        ]);
        
        const amountField = this.findFieldByNames(dataMap, [
            '金額', '価格', 'amount', '売上', '合計', 'total', '単価', 'price',
            '販売額', '収益', '値段'
        ]);
        
        const quantityField = this.findFieldByNames(dataMap, [
            '数量', 'quantity', '個数', 'count', 'qty', '提供数'
        ]);
        
        const item1Field = this.findFieldByNames(dataMap, [
            '1品目', '１品目', '第1品目', 'item1', '1品目（カクテル）', 
            '商品1', '商品１', 'product1', '品目1', 'menu1'
        ]);
        
        const item2Field = this.findFieldByNames(dataMap, [
            '2品目', '２品目', '第2品目', 'item2', '2品目（料理）',
            '商品2', '商品２', 'product2', '品目2', 'menu2'
        ]);
        
        const item3Field = this.findFieldByNames(dataMap, [
            '3品目', '３品目', '第3品目', 'item3', '3品目（カクテル）',
            '商品3', '商品３', 'product3', '品目3', 'menu3'
        ]);
        
        const staffField = this.findFieldByNames(dataMap, [
            '担当', 'スタッフ', '従業員', 'staff', '担当者', '名前', 'name'
        ]);

        console.log(`📋 フィールド検索結果:`);
        console.log(`  - 日付: ${dateField || 'なし'}`);
        console.log(`  - メニュータイプ: ${menuTypeField || 'なし'}`);
        console.log(`  - コース名: ${courseField || 'なし'}`);
        console.log(`  - 金額: ${amountField || 'なし'}`);
        console.log(`  - 数量: ${quantityField || 'なし'}`);
        console.log(`  - 担当: ${staffField || 'なし'}`);

        // 日付は必須
        if (!dateField) {
            console.log(`❌ 必須フィールド不足: 日付が見つかりません`);
            return null;
        }

        const date = this.parseDate(dateField);
        if (!date) {
            console.log(`❌ 日付解析失敗: ${dateField}`);
            return null;
        }

        // メニュータイプの取得と正規化
        let menuType = 'special'; // デフォルト
        let expectedPrice = 50000;
        
        if (menuTypeField) {
            const menuTypeLower = menuTypeField.toLowerCase().trim();
            if (menuTypeLower === 'simple' || menuTypeLower.includes('simple')) {
                menuType = 'simple';
                expectedPrice = 30000;
            } else if (menuTypeLower === 'chill' || menuTypeLower.includes('chill')) {
                menuType = 'chill';
                expectedPrice = 40000;
            } else if (menuTypeLower === 'special' || menuTypeLower.includes('special')) {
                menuType = 'special';
                expectedPrice = 50000;
            }
        }
        
        // コース名からもメニュータイプを推定（フォールバック）
        if (courseField && !menuTypeField) {
            const courseNameLower = courseField.toLowerCase();
            if (courseNameLower.includes('simple')) {
                menuType = 'simple';
                expectedPrice = 30000;
            } else if (courseNameLower.includes('chill')) {
                menuType = 'chill';
                expectedPrice = 40000;
            } else if (courseNameLower.includes('special')) {
                menuType = 'special';
                expectedPrice = 50000;
            }
        }

        // 金額の取得
        let amount = expectedPrice; // デフォルトは期待価格
        if (amountField) {
            const parsedAmount = this.parseAmount(amountField);
            if (parsedAmount && parsedAmount > 0) {
                amount = parsedAmount;
            }
        }

        // 数量の取得
        let quantity = 1; // デフォルト
        if (quantityField) {
            const parsedQuantity = parseInt(quantityField);
            if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
                quantity = parsedQuantity;
            }
        }

        // 商品情報を配列として構築
        const menuItems = [item1Field, item2Field, item3Field].filter(item => item && item.trim() !== '');

        // コース名の決定
        const menuName = courseField || `${menuType.charAt(0).toUpperCase() + menuType.slice(1)} Menu`;

        // スタッフ名の自動補完
        const staff = staffField || 'スタッフ';

        console.log(`📋 構築された情報:`);
        console.log(`  - メニュータイプ: ${menuType}`);
        console.log(`  - メニュー名: ${menuName}`);
        console.log(`  - 金額: ¥${amount}`);
        console.log(`  - 数量: ${quantity}`);
        console.log(`  - 商品: [${menuItems.join(', ')}]`);

        const result = {
            ...baseItem,
            date,
            staff,
            menuType,
            menuName,
            amount,
            total: amount * quantity,
            price: amount,
            quantity,
            course: menuName,
            menuItems
        };

        console.log(`✅ 通常メニューデータ変換成功:`, result);
        return result;
    }

    // その他収益データの変換（修正版）
    convertOtherRevenueData(dataMap, baseItem) {
        const dateField = this.findFieldByNames(dataMap, ['日付', 'date', '収益日']);
        const amountField = this.findFieldByNames(dataMap, ['金額', '価格', 'amount', '収益額']);
        
        // オプション項目（あれば使用、なければデフォルト値）
        const typeField = this.findFieldByNames(dataMap, ['種別', 'タイプ', 'type']);
        const descriptionField = this.findFieldByNames(dataMap, ['内容', '詳細', 'description', '説明']);

        if (!dateField || !amountField) {
            return null;
        }

        const date = this.parseDate(dateField);
        const amount = this.parseAmount(amountField);
        
        if (!date || amount === null || amount <= 0) {
            return null;
        }

        return {
            ...baseItem,
            date,
            amount,
            type: typeField || 'other',
            description: descriptionField || 'インポートデータ'
        };
    }

    // 出勤データの変換（修正版）
    convertAttendanceData(dataMap, baseItem) {
        console.log(`🔄 出勤データ変換開始:`, dataMap);
        
        // より広範なフィールド名で検索
        const dateField = this.findFieldByNames(dataMap, [
            '日付', 'date', '出勤日', '勤務日', '年月日', '日時', 
            '出勤', '勤務', 'attendance_date', 'work_date'
        ]);
        
        const staffField = this.findFieldByNames(dataMap, [
            '従業員', 'スタッフ', '担当', 'staff', '名前', 'name', 
            '従業員名', 'employee', 'employee_name', 'スタッフ名', '担当者'
        ]);
        
        const timeField = this.findFieldByNames(dataMap, [
            '時間', 'time', '出勤時間', '勤務時間', '時刻', 
            'start_time', 'work_time', '開始時間'
        ]);
        
        const shiftField = this.findFieldByNames(dataMap, [
            'シフト', 'shift', 'シフト種別', '勤務形態', 'shift_type', 
            '勤務種別', 'work_type'
        ]);

        console.log(`📋 フィールド検索結果:`);
        console.log(`  - 日付: ${dateField || 'なし'}`);
        console.log(`  - スタッフ: ${staffField || 'なし'}`);
        console.log(`  - 時間: ${timeField || 'なし'}`);
        console.log(`  - シフト: ${shiftField || 'なし'}`);

        // 日付は必須、スタッフは自動補完可能
        if (!dateField) {
            console.log(`❌ 必須フィールド不足: 日付が見つかりません`);
            return null;
        }

        const date = this.parseDate(dateField);
        if (!date) {
            console.log(`❌ 日付解析失敗: ${dateField}`);
            return null;
        }

        // スタッフ名の自動補完
        const staff = staffField || 'スタッフ';
        
        // 時間の自動補完
        const time = timeField || '00:00';

        // シフトタイプの正規化
        let normalizedShift = 'morning'; // デフォルト
        if (shiftField) {
            const shiftLower = shiftField.toLowerCase();
            if (shiftLower.includes('昼') || shiftLower.includes('afternoon') || shiftLower.includes('day')) {
                normalizedShift = 'afternoon';
            } else if (shiftLower.includes('夜') || shiftLower.includes('evening') || shiftLower.includes('night')) {
                normalizedShift = 'evening';
            } else if (shiftLower.includes('深夜') || shiftLower.includes('late') || shiftLower.includes('midnight')) {
                normalizedShift = 'late-night';
            }
        }

        const result = {
            ...baseItem,
            date,
            staff,
            employeeName: staff, // 互換性のため
            time,
            shift: normalizedShift
        };

        console.log(`✅ 出勤データ変換成功:`, result);
        return result;
    }

    // 日替わりメニューデータの変換（修正版）
    convertDailyMenuData(dataMap, baseItem) {
        console.log(`🔄 日替わりメニューデータ変換開始:`, dataMap);
        
        // より広範なフィールド名で検索
        const dateField = this.findFieldByNames(dataMap, [
            '日付', 'date', '提供日', '販売日', '年月日', '日時'
        ]);
        
        const amountField = this.findFieldByNames(dataMap, [
            '金額', '価格', 'amount', '売上', '合計', 'total', '単価', 'price',
            '販売額', '収益', '値段'
        ]);
        
        const quantityField = this.findFieldByNames(dataMap, [
            '数量', 'quantity', '個数', 'count', 'qty', '提供数'
        ]);
        
        const item1Field = this.findFieldByNames(dataMap, [
            '1品目', '１品目', '第1品目', 'item1', '商品1', '商品１', 
            'product1', '品目1', 'menu1'
        ]);
        
        const item2Field = this.findFieldByNames(dataMap, [
            '2品目', '２品目', '第2品目', 'item2', '商品2', '商品２',
            'product2', '品目2', 'menu2'
        ]);
        
        const item3Field = this.findFieldByNames(dataMap, [
            '3品目', '３品目', '第3品目', 'item3', '商品3', '商品３',
            'product3', '品目3', 'menu3'
        ]);

        console.log(`📋 フィールド検索結果:`);
        console.log(`  - 日付: ${dateField || 'なし'}`);
        console.log(`  - 金額: ${amountField || 'なし'}`);
        console.log(`  - 数量: ${quantityField || 'なし'}`);
        console.log(`  - 商品1: ${item1Field || 'なし'}`);
        console.log(`  - 商品2: ${item2Field || 'なし'}`);
        console.log(`  - 商品3: ${item3Field || 'なし'}`);

        // 日付は必須
        if (!dateField) {
            console.log(`❌ 必須フィールド不足: 日付が見つかりません`);
            return null;
        }

        const date = this.parseDate(dateField);
        if (!date) {
            console.log(`❌ 日付解析失敗: ${dateField}`);
            return null;
        }

        // 金額の取得（単価または合計）
        let amount = 0;
        if (amountField) {
            amount = this.parseAmount(amountField);
        }
        
        // 金額が0または取得できない場合、動的価格を使用
        if (!amount || amount <= 0) {
            amount = this.getDailyMenuPrice();
            console.log(`💰 金額を動的価格に設定: ¥${amount}`);
        }

        // 数量の取得
        let quantity = 1; // デフォルト
        if (quantityField) {
            const parsedQuantity = parseInt(quantityField);
            if (!isNaN(parsedQuantity) && parsedQuantity > 0) {
                quantity = parsedQuantity;
            }
        }

        // 商品情報を配列として構築
        const menuItems = [item1Field, item2Field, item3Field].filter(item => item && item.trim() !== '');

        console.log(`📋 構築された商品情報: [${menuItems.join(', ')}]`);

        // 商品情報がない場合は最低限の情報で作成
        if (menuItems.length === 0) {
            menuItems.push('日替わりメニュー');
            console.log(`📋 商品情報なし - デフォルト設定`);
        }

        const result = {
            ...baseItem,
            date,
            amount,
            total: amount * quantity, // 合計 = 単価 × 数量
            quantity,
            menuItems,
            menuName: `日替わりメニュー (${menuItems.length}品)`,
            price: amount, // 単価
            staff: 'スタッフ' // デフォルト担当者
        };

        console.log(`✅ 日替わりメニューデータ変換成功:`, result);
        return result;
    }

    // 支出データの変換（修正版）
    convertExpenseData(dataMap, baseItem) {
        const dateField = this.findFieldByNames(dataMap, ['日付', 'date', '仕入れ日']);
        const categoryField = this.findFieldByNames(dataMap, ['カテゴリ', 'category', '種別', '分類']);
        const descriptionField = this.findFieldByNames(dataMap, ['内容', '詳細', 'description', '説明']);
        const amountField = this.findFieldByNames(dataMap, ['金額', '価格', 'amount', '支出額']);

        if (!dateField || !amountField) {
            return null;
        }

        const date = this.parseDate(dateField);
        const amount = this.parseAmount(amountField);
        
        if (!date || amount === null || amount <= 0) {
            return null;
        }

        // カテゴリの正規化
        let normalizedCategory = 'other';
        if (categoryField) {
            const categoryLower = categoryField.toLowerCase();
            if (categoryLower.includes('食材') || categoryLower.includes('ingredients')) {
                normalizedCategory = 'ingredients';
            } else if (categoryLower.includes('アルコール') || categoryLower.includes('alcohol')) {
                normalizedCategory = 'alcohol';
            } else if (categoryLower.includes('備品') || categoryLower.includes('supplies')) {
                normalizedCategory = 'supplies';
            }
        }

        return {
            ...baseItem,
            date,
            category: normalizedCategory,
            description: descriptionField || 'インポートデータ',
            amount
        };
    }

    // 金庫データの変換（修正版）
    convertVaultData(dataMap, baseItem) {
        const dateField = this.findFieldByNames(dataMap, ['日付', 'date', '取引日']);
        const typeField = this.findFieldByNames(dataMap, ['種別', 'タイプ', 'type']);
        const amountField = this.findFieldByNames(dataMap, ['金額', '価格', 'amount']);
        const descriptionField = this.findFieldByNames(dataMap, ['内容', '詳細', 'description', '取引内容']);

        if (!dateField || !amountField) {
            return null;
        }

        const date = this.parseDate(dateField);
        const amount = this.parseAmount(amountField);
        
        if (!date || amount === null || amount <= 0) {
            return null;
        }

        // 取引種別の正規化
        let normalizedType = 'deposit';
        if (typeField) {
            const typeLower = typeField.toLowerCase();
            if (typeLower.includes('出金') || typeLower.includes('withdrawal')) {
                normalizedType = 'withdrawal';
            }
        }

        return {
            ...baseItem,
            date,
            type: normalizedType,
            amount,
            description: descriptionField || 'インポートデータ'
        };
    }

    // 金額パース（修正版）
    parseAmount(value) {
        if (!value) return 0;
        
        // 文字列を数値に変換
        const cleanValue = value.toString().replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleanValue);
        
        return isNaN(parsed) ? 0 : Math.abs(parsed); // 常に正の値を返す
    }

    // 日付パース（修正版）
    parseDate(value) {
        if (!value) return null;
        
        const dateStr = value.toString().trim();
        
        // 様々な日付形式を試行
        const dateFormats = [
            dateStr, // そのまま
            dateStr.replace(/[年月]/g, '-').replace(/日/g, ''), // 年月日形式
            dateStr.replace(/\//g, '-'), // スラッシュをハイフンに
            dateStr.replace(/\./g, '-'), // ドットをハイフンに
            dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), // YYYYMMDD形式
        ];

        for (const format of dateFormats) {
            try {
                const date = new Date(format);
                if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
                    return date.toISOString().split('T')[0];
                }
            } catch (e) {
                continue;
            }
        }

        // パースできない場合はnullを返す（エラーレコードとして扱う）
        return null;
    }

    // フィールド名検索（大文字小文字・全角半角に対応）
    findFieldByNames(dataMap, names) {
        for (const name of names) {
            // 完全一致
            const exactMatch = dataMap[name];
            if (exactMatch !== undefined && exactMatch !== null && exactMatch !== '') {
                return exactMatch;
            }

            // 部分一致（大文字小文字・全角半角を考慮）
            for (const [key, value] of Object.entries(dataMap)) {
                if (value !== undefined && value !== null && value !== '') {
                    const normalizedKey = key.toLowerCase().replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                    const normalizedName = name.toLowerCase().replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                    
                    if (normalizedKey.includes(normalizedName) || normalizedName.includes(normalizedKey)) {
                        return value;
                    }
                }
            }
        }
        return null;
    }

    // データ統合と詳細レポート（重複チェック無効版）
    mergeImportedDataWithReport(dataType, importedData) {
        const result = {
            added: 0,
            skipped: 0,
            newRecords: 0,
            duplicateRecords: 0,
            totalProcessed: importedData.length
        };

        const dataKey = this.getDataKey(dataType);
        if (!this.data[dataKey]) {
            this.data[dataKey] = [];
        }

        importedData.forEach(newItem => {
            // 重複チェックを完全に無効化 - すべてのデータを強制追加
            this.data[dataKey].push(newItem);
            result.added++;
            result.newRecords++;
        });

        // データ保存と表示更新
        this.saveData();

        return result;
    }

    // データタイプ別重複チェック（修正版）
    checkDuplicateRecord(existingData, newItem, dataType) {
        return existingData.some(existingItem => {
            switch (dataType) {
                case 'attendance':
                    // 出勤データ: 同じ日付（日付部分のみ）の同じ従業員は重複
                    return this.extractDateFromDateTime(existingItem.date) === this.extractDateFromDateTime(newItem.date) && 
                           existingItem.employeeName === newItem.employeeName;
                
                case 'daily-menu':
                case 'regular-menu':
                    // メニューデータ: 同じ日付で同じ金額・数量は重複
                    return existingItem.date === newItem.date && 
                           ((existingItem.total && newItem.total && existingItem.total === newItem.total) ||
                            (existingItem.price === newItem.price && existingItem.quantity === newItem.quantity) ||
                            (existingItem.menuType === newItem.menuType && existingItem.menuName === newItem.menuName));
                
                case 'other-revenue':
                case 'expenses':
                    // 収益・支出データ: 同じ日付で同じ金額・説明は重複
                    return existingItem.date === newItem.date && 
                           existingItem.amount === newItem.amount &&
                           (existingItem.description === newItem.description || 
                            existingItem.type === newItem.type || 
                            existingItem.category === newItem.category);
                
                case 'vault':
                    // 金庫データ: 同じ日付・金額・種別は重複
                    return existingItem.date === newItem.date && 
                           existingItem.amount === newItem.amount &&
                           existingItem.type === newItem.type;
                
                default:
                    // デフォルト: 日付と主要フィールドで判定
                    return existingItem.date === newItem.date && 
                           (existingItem.amount === newItem.amount || 
                            existingItem.total === newItem.total ||
                            existingItem.employeeName === newItem.employeeName);
            }
        });
    }

    // インポートレポートの作成
    createImportReport(parseResult, mergeResult, dataType) {
        const dataTypeName = this.getDataTypeDisplayName(dataType);
        
        let summary = `✅ ${dataTypeName}のインポートが完了しました\n`;
        summary += `📊 解析結果: ${parseResult.total}件中 ${mergeResult.added}件を追加\n`;
        
        if (mergeResult.skipped > 0) {
            summary += `⚠️ スキップ: ${mergeResult.skipped}件（重複または無効なデータ）\n`;
        }
        
        if (parseResult.errors && parseResult.errors.length > 0) {
            summary += `❌ エラー: ${parseResult.errors.length}件\n`;
        }

        const report = {
            success: true,
            summary,
            details: {
                dataType: dataTypeName,
                totalProcessed: parseResult.total,
                successful: mergeResult.added,
                skipped: mergeResult.skipped,
                errors: parseResult.errors || [],
                requirements: this.getDataTypeRequirements(dataType)
            }
        };

        return report;
    }

    // データタイプ要件の定義
    getDataTypeRequirements(dataType) {
        const requirements = {
            'daily-menu': {
                name: '日替わりメニュー',
                required: ['日付', '金額', '1品目', '2品目', '3品目'],
                description: '日付、金額、1品目、2品目、3品目が必要です'
            },
            'regular-menu': {
                name: 'その他メニュー',
                required: ['日付', 'コース名', '金額', '1品目', '2品目', '3品目'],
                description: '日付、コース名、金額、1品目、2品目、3品目が必要です'
            },
            'other-menu': {
                name: 'その他メニュー',
                required: ['日付', 'コース名', '金額', '1品目', '2品目', '3品目'],
                description: '日付、コース名、金額、1品目、2品目、3品目が必要です'
            },
            'other-revenue': {
                name: 'その他収益',
                required: ['日付', '金額'],
                description: '日付、金額が必要です'
            },
            'attendance': {
                name: '出勤記録',
                required: ['日付', '従業員名'],
                description: '日付、従業員名が必要です'
            },
            'expense': {
                name: '支出記録',
                required: ['日付', '金額'],
                description: '日付、金額が必要です'
            },
            'vault': {
                name: '金庫取引',
                required: ['日付', '金額'],
                description: '日付、金額が必要です'
            }
        };

        return requirements[dataType] || { name: dataType, required: [], description: '' };
    }

    // 詳細インポート結果の表示
    showDetailedImportAlert(report, dataType) {
        const typeName = this.getDataTypeDisplayName(dataType);
        let message = `📊 ${typeName}データインポート完了\n\n`;
        
        // 新しいレポート構造に対応
        if (report.details) {
            message += `✅ 新規追加: ${report.details.successful}件\n`;
            
            if (report.details.errors && report.details.errors.length > 0) {
                message += `❌ エラー: ${report.details.errors.length}件\n`;
                message += `（詳細はコンソールをご確認ください）\n`;
            }
        } else {
            // 古い形式との互換性
            message += `✅ 新規追加: ${report.newRecords || report.added || 0}件\n`;
            
            if (report.errors && report.errors.length > 0) {
                message += `❌ エラー: ${report.errors.length}件\n`;
                message += `（詳細はコンソールをご確認ください）\n`;
            }
        }

        message += `\n💡 重複チェックは無効化されており、すべてのデータが追加されます`;

        const hasErrors = (report.details?.errors?.length > 0) || (report.errors?.length > 0);
        this.showAlert(message, hasErrors ? 'warning' : 'success');
        
        // 詳細をコンソールに出力
        console.log('📊 インポート詳細レポート:', report);
    }

    // CSVパースとデータ変換（柔軟な構造対応）
    parseCSV(csvText, dataType) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 1) return [];

        let headers = [];
        let startIndex = 0;

        // ヘッダー行を自動検出（数値データが少ない行をヘッダーとみなす）
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            const testLine = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const numericCount = testLine.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
            const totalCount = testLine.length;
            
            // 数値の割合が50%未満の行をヘッダーとみなす
            if (numericCount / totalCount < 0.5) {
                headers = testLine;
                startIndex = i + 1;
                break;
            }
        }

        // ヘッダーが見つからない場合は、汎用ヘッダーを生成
        if (headers.length === 0 && lines.length > 0) {
            const firstLine = lines[0].split(',');
            headers = firstLine.map((_, index) => `列${index + 1}`);
            startIndex = 0;
        }

        const data = [];
        const requiredFields = this.getRequiredFields(dataType);

        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            
            // 行が空またはほぼ空の場合はスキップ
            if (values.filter(v => v.trim()).length === 0) continue;

            const item = this.convertCSVRowToDataAdvanced(headers, values, dataType, requiredFields);
            if (item) {
                data.push(item);
            }
        }

        return data;
    }

    // CSV行の高度なパース（カンマが含まれる値にも対応）
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    }

    // データタイプ別必須フィールドの定義
    getRequiredFields(dataType) {
        const fieldMap = {
            'attendance': ['employeeName', 'date'],
            'daily-menu': ['date'],
            'regular-menu': ['date'], // priceとtotalは自動生成されるため必須から除外
            'other-revenue': ['date'], // amountは自動補完されるため必須から除外
            'expenses': ['date'], // amountは自動補完されるため必須から除外
            'vault': ['date', 'amount', 'type'] // 金庫データのみ厳密
        };

        return fieldMap[dataType] || [];
    }

    // データタイプ表示名の取得
    getDataTypeDisplayName(dataType) {
        const displayNames = {
            'attendance': '出勤確認',
            'daily-menu': '日替わりメニュー',
            'regular-menu': 'その他メニュー',
            'other-revenue': 'その他収益',
            'expenses': '収支表',
            'vault': '金庫データ'
        };
        return displayNames[dataType] || dataType;
    }

    // 🆘 緊急バックアップ作成
    createEmergencyBackup() {
        const backupData = {
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(this.data)), // ディープコピー
            version: '緊急バックアップ'
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { 
            type: 'application/json;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `緊急バックアップ_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
        link.click();
        
        this.showAlert('🆘 緊急バックアップを作成しました！安全な場所に保存してください', 'warning');
        
        return backupData;
    }

    // バックアップからの復元
    async restoreFromBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const backupData = JSON.parse(text);
            
            if (confirm('⚠️ 現在のデータを完全に置き換えますか？\n（この操作は元に戻せません）')) {
                this.data = backupData.data;
                this.saveData();
                this.updateAllDisplays();
                this.updateDataStatistics();
                
                this.showAlert(`✅ バックアップから復元しました（${backupData.timestamp}）`, 'success');
            }
        } catch (error) {
            this.showAlert('❌ バックアップファイルの読み込みに失敗しました', 'error');
            console.error('復元エラー:', error);
        }
        
        event.target.value = '';
    }

    // 重複データの除去
    removeDuplicateData(dataType) {
        const dataKey = this.getDataKey(dataType);
        const data = this.data[dataKey] || [];
        
        if (data.length === 0) {
            this.showAlert(`${this.getDataTypeDisplayName(dataType)}データがありません`, 'info');
            return;
        }

        const originalCount = data.length;
        const uniqueData = [];

        data.forEach(item => {
            const isDuplicate = this.checkDuplicateRecord(uniqueData, item, dataType);
            if (!isDuplicate) {
                uniqueData.push(item);
            }
        });

        const removedCount = originalCount - uniqueData.length;
        
        if (removedCount > 0) {
            this.data[dataKey] = uniqueData;
            this.saveData();
            this.updateAllDisplays();
            this.updateDataStatistics();
            
            this.showAlert(`${this.getDataTypeDisplayName(dataType)}から${removedCount}件の重複データを削除しました`, 'success');
        } else {
            this.showAlert(`${this.getDataTypeDisplayName(dataType)}に重複データは見つかりませんでした`, 'info');
        }
    }

    // 全データの重複除去
    removeAllDuplicates() {
        const dataTypes = ['attendance', 'daily-menu', 'regular-menu', 'other-revenue', 'expenses', 'vault'];
        let totalRemoved = 0;

        dataTypes.forEach(dataType => {
            const dataKey = this.getDataKey(dataType);
            const data = this.data[dataKey] || [];
            
            if (data.length === 0) return;

            const originalCount = data.length;
            const uniqueData = [];

            data.forEach(item => {
                const isDuplicate = this.checkDuplicateRecord(uniqueData, item, dataType);
                if (!isDuplicate) {
                    uniqueData.push(item);
                }
            });

            const removedCount = originalCount - uniqueData.length;
            totalRemoved += removedCount;
            
            if (removedCount > 0) {
                this.data[dataKey] = uniqueData;
            }
        });

        if (totalRemoved > 0) {
            this.saveData();
            this.updateAllDisplays();
            this.updateDataStatistics();
            
            this.showAlert(`全データから合計${totalRemoved}件の重複データを削除しました`, 'success');
        } else {
            this.showAlert('重複データは見つかりませんでした', 'info');
        }
    }

    // 出勤データの重複を詳細表示付きで削除
    removeAttendanceDuplicates() {
        console.log('🔧 重複削除処理を開始します');
        
        try {
            const originalData = this.data.attendance || [];
            console.log(`📊 総出勤データ数: ${originalData.length}`);
            
            if (originalData.length === 0) {
                alert('📋 出勤データなし\n\n現在、出勤データが登録されていません。');
                return;
            }

            const uniqueData = [];
            const duplicates = [];
            const duplicateDetails = {};

            originalData.forEach(item => {
                const isDuplicate = this.checkDuplicateRecord(uniqueData, item, 'attendance');
                if (isDuplicate) {
                    duplicates.push(item);
                    const dateKey = this.extractDateFromDateTime(item.date);
                    const employeeKey = `${item.employeeName}-${dateKey}`;
                    
                    if (!duplicateDetails[employeeKey]) {
                        duplicateDetails[employeeKey] = {
                            employee: item.employeeName,
                            date: dateKey,
                            count: 1
                        };
                    }
                    duplicateDetails[employeeKey].count++;
                } else {
                    uniqueData.push(item);
                }
            });

            console.log(`🔍 重複チェック結果: ${duplicates.length}件の重複を発見`);

            if (duplicates.length === 0) {
                alert('✅ 重複データなし\n\n出勤データに重複はありませんでした。\n各従業員は既に1日1回のみ記録されています。');
                return;
            }

            // 重複詳細の表示
            const duplicateList = Object.values(duplicateDetails)
                .map(detail => `${detail.employee}: ${this.formatDate(detail.date)} (${detail.count}回)`)
                .join('\n');

            const confirmMessage = `以下の重複出勤記録を削除しますか？\n\n${duplicateList}\n\n合計 ${duplicates.length} 件の重複を削除し、各従業員は1日1回の記録のみ残します。`;

            if (confirm(confirmMessage)) {
                console.log('👤 ユーザーが削除を承認しました');
                this.data.attendance = uniqueData;
                this.saveData();
                this.updateAllDisplays();
                
                alert(`✅ 重複削除完了\n\n出勤データの重複 ${duplicates.length} 件を削除しました。\n各従業員は1日1回のみの記録になりました。`);
                console.log('🎉 重複削除処理が完了しました');
            } else {
                console.log('❌ ユーザーが削除をキャンセルしました');
            }
        } catch (error) {
            console.error('❌ 重複削除処理でエラーが発生:', error);
            alert('⚠️ エラーが発生しました\n\n重複削除処理中にエラーが発生しました。\nページを再読み込みしてから再度お試しください。\n\nエラー詳細: ' + error.message);
        }
    }

    // データエクスポート
    exportData(dataType) {
        const dataKey = this.getDataKey(dataType);
        const data = this.data[dataKey] || [];
        
        if (data.length === 0) {
            this.showAlert('エクスポートするデータがありません', 'info');
            return;
        }

        const csv = this.convertToCSV(data, dataType);
        const displayName = this.getDataTypeDisplayName(dataType);
        this.downloadCSV(csv, `${displayName}_${new Date().toISOString().split('T')[0]}.csv`);
        
        this.showAlert(`${displayName}データをエクスポートしました（${data.length}件）`, 'success');
    }

    // 全データエクスポート
    exportAllData() {
        const allData = {
            attendance: this.data.attendance || [],
            dailyMenu: this.data.dailyMenu || [],
            regularMenu: this.data.regularMenu || [],
            otherRevenue: this.data.otherRevenue || [],
            expenses: this.data.expenses || [],
            vaultTransactions: this.data.vaultTransactions || []
        };

        let totalRecords = 0;
        const zip = []; // シンプルなzip代替

        Object.entries(allData).forEach(([key, data]) => {
            if (data.length > 0) {
                // データキーをデータタイプに変換
                const dataType = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                const csv = this.convertToCSV(data, dataType);
                const displayName = this.getDataTypeDisplayName(dataType);
                zip.push(`=== ${displayName} (${data.length}件) ===\n${csv}\n\n`);
                totalRecords += data.length;
            }
        });

        if (totalRecords === 0) {
            this.showAlert('エクスポートするデータがありません', 'info');
            return;
        }

        const allCSV = zip.join('');
        this.downloadCSV(allCSV, `RushLounge_全データ_${new Date().toISOString().split('T')[0]}.txt`);
        
        this.showAlert(`全データをエクスポートしました（合計${totalRecords}件）`, 'success');
    }

    // データをCSV形式に変換
    convertToCSV(data, dataType) {
        if (data.length === 0) return '';

        const headers = this.getCSVHeaders(dataType);
        const rows = data.map(item => this.getCSVRow(item, dataType));
        
        return [headers.join(','), ...rows].join('\n');
    }

    // CSV用ヘッダーの取得
    getCSVHeaders(dataType) {
        const headerMap = {
            'attendance': ['従業員名', '日時'],
            'daily-menu': ['日付', '商品1', '商品2', '商品3', '数量', '単価', '合計'],
            'dailyMenu': ['日付', '商品1', '商品2', '商品3', '数量', '単価', '合計'],
            'regular-menu': ['日付', 'メニュータイプ', 'メニュー名', '数量', '単価', '合計'],
            'regularMenu': ['日付', 'メニュータイプ', 'メニュー名', '数量', '単価', '合計'],
            'other-revenue': ['日付', '種別', '内容', '金額'],
            'otherRevenue': ['日付', '種別', '内容', '金額'],
            'expenses': ['日付', '種別', '内容', '金額'],
            'vault': ['日付', '種別', '内容', '金額'],
            'vaultTransactions': ['日付', '種別', '内容', '金額']
        };
        return headerMap[dataType] || ['データ'];
    }

    // CSV用行データの取得
    getCSVRow(item, dataType) {
        switch (dataType) {
            case 'attendance':
                return [item.employeeName || '', item.date || ''];
            case 'daily-menu':
            case 'dailyMenu':
                const menuItems = item.menuItems || [];
                return [
                    item.date || '',
                    menuItems[0] || '',
                    menuItems[1] || '',
                    menuItems[2] || '',
                    item.quantity || '',
                    item.price || '',
                    item.total || ''
                ];
            case 'regular-menu':
            case 'regularMenu':
                return [
                    item.date || '',
                    item.menuType || '',
                    item.menuName || '',
                    item.quantity || '',
                    item.price || '',
                    item.total || ''
                ];
            case 'other-revenue':
            case 'otherRevenue':
                return [
                    item.date || '',
                    item.type || '',
                    item.description || '',
                    item.amount || ''
                ];
            case 'expenses':
                return [
                    item.date || '',
                    item.category || '',
                    item.description || '',
                    item.amount || ''
                ];
            case 'vault':
            case 'vaultTransactions':
                return [
                    item.date || '',
                    item.type === 'deposit' ? '入金' : '出金',
                    item.description || '',
                    item.amount || ''
                ];
            default:
                return [JSON.stringify(item)];
        }
    }

    // CSVダウンロード
    downloadCSV(csvContent, fileName) {
        // BOMを追加してExcelでの文字化けを防止
        const bom = '\uFEFF';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // データ統計の更新
    updateDataStatistics() {
        const counts = {
            attendance: this.data.attendance?.length || 0,
            dailyMenu: this.data.dailyMenu?.length || 0,
            regularMenu: this.data.regularMenu?.length || 0,
            otherRevenue: this.data.otherRevenue?.length || 0,
            expenses: this.data.expenses?.length || 0,
            vaultTransactions: this.data.vaultTransactions?.length || 0,
            employees: this.data.employees?.filter(emp => emp.active)?.length || 0
        };

        Object.entries(counts).forEach(([key, count]) => {
            const element = document.getElementById(`${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-count`);
            if (element) {
                if (key === 'employees') {
                    element.textContent = `${count}名`;
                } else {
                    element.textContent = `${count}件`;
                }
            }
        });

        // 削除用のカウント表示も更新
        this.updateDeleteCounts();
    }

    // 削除セクション用カウントの更新
    updateDeleteCounts() {
        const deleteCounts = {
            'attendance': this.data.attendance?.length || 0,
            'daily-menu': this.data.dailyMenu?.length || 0,
            'regular-menu': this.data.regularMenu?.length || 0,
            'other-revenue': this.data.otherRevenue?.length || 0,
            'expenses': this.data.expenses?.length || 0,
            'vault': this.data.vaultTransactions?.length || 0
        };

        Object.entries(deleteCounts).forEach(([dataType, count]) => {
            const element = document.getElementById(`${dataType}-delete-count`);
            if (element) {
                element.textContent = `${count}件`;
            }
        });
    }

    // 特定データタイプの全削除
    deleteAllData(dataType) {
        const displayName = this.getDataTypeDisplayName(dataType);
        const dataKey = this.getDataKey(dataType);
        const currentCount = this.data[dataKey]?.length || 0;

        if (currentCount === 0) {
            this.showAlert(`${displayName}のデータがありません`, 'info');
            return;
        }

        const confirmMessage = `⚠️ 危険な操作です！\n\n` +
            `${displayName}のデータをすべて削除します（${currentCount}件）\n\n` +
            `この操作は元に戻すことができません。\n` +
            `事前にバックアップを作成することを強く推奨します。\n\n` +
            `本当に削除しますか？`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // 最終確認
        const finalConfirm = `最終確認：\n\n` +
            `「${displayName}のデータを完全に削除する」\n\n` +
            `上記に同意する場合は「OK」を押してください`;

        if (!confirm(finalConfirm)) {
            return;
        }

        try {
            // データを削除
            this.data[dataKey] = [];
            
            // 保存とUI更新
            this.saveData();
            this.updateAllDisplays();
            this.updateDataStatistics();

            this.showAlert(`✅ ${displayName}のデータを完全に削除しました（${currentCount}件）`, 'success');
            
            console.log(`データ削除完了: ${dataType} (${currentCount}件)`);
            
        } catch (error) {
            console.error('データ削除エラー:', error);
            this.showAlert('❌ データ削除中にエラーが発生しました', 'error');
        }
    }

    // システム全データの削除
    deleteAllSystemData() {
        const confirmMessage = `🚨 システム全データ削除 🚨\n\n` +
            `以下のすべてのデータを完全に削除します：\n` +
            `• 出勤記録: ${this.data.attendance?.length || 0}件\n` +
            `• 日替わりメニュー: ${this.data.dailyMenu?.length || 0}件\n` +
            `• その他メニュー: ${this.data.regularMenu?.length || 0}件\n` +
            `• その他収益: ${this.data.otherRevenue?.length || 0}件\n` +
            `• 収支表: ${this.data.expenses?.length || 0}件\n` +
            `• 金庫取引: ${this.data.vaultTransactions?.length || 0}件\n` +
            `• 従業員情報: ${this.data.employees?.length || 0}名\n` +
            `• 商品情報: ${this.data.products?.length || 0}品\n` +
            `• コース情報: ${this.data.courses?.length || 0}コース\n\n` +
            `⚠️ この操作は完全に元に戻すことができません！\n` +
            `⚠️ 事前にバックアップを作成してください！\n\n` +
            `本当にすべてのデータを削除しますか？`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // 最終確認（タイプ入力）
        const confirmText = prompt(
            `最終確認のため、以下のテキストを正確に入力してください：\n\n` +
            `「全データを削除します」\n\n` +
            `入力してください:`
        );

        if (confirmText !== '全データを削除します') {
            this.showAlert('❌ 確認テキストが正しくありません。削除を中止しました', 'info');
            return;
        }

        try {
            // すべてのデータを初期化
            this.data = {
                attendance: [],
                dailyMenu: [],
                dailyMenuConfigs: [],
                regularMenu: [],
                otherRevenue: [],
                expenses: [],
                vaultTransactions: [],
                employees: [],
                products: [],
                courses: [],
                materials: [],
                vaultBalance: 0,
                pendingSavings: 0
            };

            // 保存とUI更新
            this.saveData();
            this.updateAllDisplays();
            this.updateDataStatistics();

            this.showAlert('🗑️ 全システムデータを完全に削除しました', 'success');
            
            console.log('全データ削除完了');
            
        } catch (error) {
            console.error('全データ削除エラー:', error);
            this.showAlert('❌ データ削除中にエラーが発生しました', 'error');
        }
    }

    // ========== リアルタイム保存機能 ==========

    // リアルタイム保存の設定
    setupRealTimeSave() {
        // 全ての入力フィールドにリアルタイム保存を追加
        const inputSelectors = [
            'input[type="text"]',
            'input[type="number"]',
            'input[type="date"]',
            'input[type="datetime-local"]',
            'select',
            'textarea'
        ];

        inputSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                // すでにリスナーが設定されている場合はスキップ
                if (element.hasAttribute('data-realtime-save')) return;
                
                element.setAttribute('data-realtime-save', 'true');
                
                // 変更時に自動保存
                element.addEventListener('change', () => {
                    this.debouncedSave();
                });
                
                // 入力時にも自動保存（デバウンス付き）
                element.addEventListener('input', () => {
                    this.debouncedSave();
                });
            });
        });
    }

    // デバウンス付き保存（500ms後に実行）
    debouncedSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveData();
        }, 500);
    }

    // ========== GitHub Pages デプロイ機能 ==========

    // 全ファイルのダウンロード
    downloadAllFiles() {
        try {
            // index.html の内容取得
            const htmlContent = document.documentElement.outerHTML;
            
            // script.js の内容取得（現在のスクリプトから取得）
            let scriptContent = '';
            document.querySelectorAll('script').forEach(script => {
                if (script.src && script.src.includes('script.js')) {
                    // 外部ファイルの場合（実際の内容は取得困難なので案内メッセージ）
                    scriptContent = '// 注意: script.jsファイルは手動でダウンロードしてください';
                } else if (!script.src) {
                    scriptContent += script.innerHTML + '\n';
                }
            });
            
            // style.css の内容取得（現在のスタイルから取得）
            let styleContent = '';
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (link.href && link.href.includes('style.css')) {
                    styleContent = '/* 注意: style.cssファイルは手動でダウンロードしてください */';
                }
            });
            
            // README.md の内容生成
            const readmeContent = this.generateReadmeContent();
            
            // ZIPファイルシミュレーション（個別ダウンロード）
            this.downloadFile('index.html', htmlContent);
            
            setTimeout(() => this.downloadFile('README.md', readmeContent), 500);
            
            this.showAlert('ファイルのダウンロードを開始しました。script.jsとstyle.cssは手動でダウンロードしてください。', 'info');
            
        } catch (error) {
            console.error('ダウンロードエラー:', error);
            this.showAlert('ファイルのダウンロードに失敗しました', 'error');
        }
    }

    // 個別ファイルダウンロード
    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // README.md の内容生成
    generateReadmeContent() {
        const employeeCount = this.data.employees ? this.data.employees.filter(emp => emp.active).length : 0;
        const productCount = this.data.products ? this.data.products.length : 0;
        const courseCount = this.data.courses ? this.data.courses.length : 0;
        
        return `# Rush Lounge 管理システム

## 📋 システム概要
GTA5 FiveMサーバー「Rush Lounge」バー経営管理システム

## 🏢 店舗情報
- **店舗名**: Rush Lounge
- **在籍従業員**: ${employeeCount}名
- **登録商品**: ${productCount}品
- **登録コース**: ${courseCount}コース

## 🚀 利用方法
1. ブラウザでindex.htmlを開く
2. 各タブで業務管理を実施
3. データは自動的にFirebaseで共有されます

## 📊 機能一覧
- 📅 出勤確認（カレンダー対応）
- 🍽️ メニュー売上管理
- 💰 収支・金庫管理
- 📈 統計・ボーナス計算
- 👥 従業員管理
- 📦 商品・コース管理
- 📋 データインポート・エクスポート

## 🔄 最終更新
${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}

---
© 2024 Rush Lounge Management System
`;
    }

    // GitHub URL保存
    saveGitHubUrl() {
        const url = document.getElementById('github-repo-url').value.trim();
        if (!url) {
            this.showAlert('GitHubリポジトリURLを入力してください', 'error');
            return;
        }
        
        if (!url.includes('github.com')) {
            this.showAlert('有効なGitHubのURLを入力してください', 'error');
            return;
        }
        
        localStorage.setItem('rushLounge_githubUrl', url);
        this.showAlert('GitHubリポジトリURLを保存しました', 'success');
    }

    // 公開URL保存
    savePublicUrl() {
        const url = document.getElementById('github-pages-url').value.trim();
        if (!url) {
            this.showAlert('GitHub Pages URLを入力してください', 'error');
            return;
        }
        
        if (!url.includes('github.io')) {
            this.showAlert('有効なGitHub PagesのURLを入力してください', 'error');
            return;
        }
        
        localStorage.setItem('rushLounge_publicUrl', url);
        this.showAlert('公開URLを保存しました', 'success');
    }

    // 保存されたURLの読み込み
    loadSavedUrls() {
        const githubUrl = localStorage.getItem('rushLounge_githubUrl');
        const publicUrl = localStorage.getItem('rushLounge_publicUrl');
        
        if (githubUrl) {
            const githubInput = document.getElementById('github-repo-url');
            if (githubInput) githubInput.value = githubUrl;
        }
        
        if (publicUrl) {
            const publicInput = document.getElementById('github-pages-url');
            if (publicInput) publicInput.value = publicUrl;
        }
    }

    // ========== 従業員管理機能 ==========

    // 従業員追加処理
    handleAddEmployee(event) {
        event.preventDefault();
        
        const name = document.getElementById('employee-name').value.trim();
        const joinDate = document.getElementById('employee-join-date').value;
        
        if (!name) {
            this.showAlert('従業員名を入力してください', 'error');
            return;
        }
        
        // 重複チェック
        if (this.data.employees.some(emp => emp.name === name && emp.active)) {
            this.showAlert('同じ名前の従業員が既に存在します', 'error');
            return;
        }
        
        const newEmployee = {
            id: Date.now(),
            name: name,
            joinDate: joinDate || new Date().toISOString().split('T')[0],
            active: true,
            timestamp: new Date().toISOString()
        };
        
        this.data.employees.push(newEmployee);
        this.saveData();
        this.updateEmployeeDisplay();
        this.updateEmployeeSelectors();
        
        this.showAlert(`従業員「${name}」を追加しました`, 'success');
        event.target.reset();
        this.setCurrentDate();
    }

    // 従業員編集処理
    editEmployee(id) {
        const employee = this.data.employees.find(emp => emp.id === id);
        if (!employee) return;

        const newName = prompt('従業員名を変更してください', employee.name);
        if (newName === null) return; // キャンセル

        if (!newName.trim()) {
            this.showAlert('従業員名を入力してください', 'error');
            return;
        }

        // 重複チェック（自分以外）
        if (this.data.employees.some(emp => emp.name === newName.trim() && emp.id !== id && emp.active)) {
            this.showAlert('同じ名前の従業員が既に存在します', 'error');
            return;
        }

        const oldName = employee.name;
        employee.name = newName.trim();
        employee.timestamp = new Date().toISOString();

        this.saveData();
        this.updateEmployeeDisplay();
        this.updateEmployeeSelectors();
        
        this.showAlert(`従業員名を「${oldName}」から「${newName.trim()}」に変更しました`, 'success');
    }

    // 従業員削除処理
    deleteEmployee(id) {
        const employee = this.data.employees.find(emp => emp.id === id);
        if (!employee) return;

        if (!confirm(`従業員「${employee.name}」を削除しますか？\n\n注意：この従業員の出勤記録は削除されません。`)) {
            return;
        }

        // 従業員を非アクティブにする（完全削除ではなく）
        employee.active = false;
        employee.timestamp = new Date().toISOString();

        this.saveData();
        this.updateEmployeeDisplay();
        this.updateEmployeeSelectors();
        
        this.showAlert(`従業員「${employee.name}」を削除しました`, 'success');
    }

    // 従業員復活処理
    restoreEmployee(id) {
        const employee = this.data.employees.find(emp => emp.id === id);
        if (!employee) return;

        employee.active = true;
        employee.timestamp = new Date().toISOString();

        this.saveData();
        this.updateEmployeeDisplay();
        this.updateEmployeeSelectors();
        
        this.showAlert(`従業員「${employee.name}」を復活させました`, 'success');
    }

    // 従業員表示の更新
    updateEmployeeDisplay() {
        const activeEmployees = this.data.employees.filter(emp => emp.active);
        const inactiveEmployees = this.data.employees.filter(emp => !emp.active);

        // アクティブ従業員リスト
        const activeList = document.getElementById('active-employees-list');
        if (activeList) {
            if (activeEmployees.length === 0) {
                activeList.innerHTML = '<p class="no-data">従業員がいません</p>';
            } else {
                activeList.innerHTML = activeEmployees.map(employee => `
                    <div class="employee-item">
                        <div class="employee-info">
                            <strong>${employee.name}</strong>
                            <span class="employee-join-date">入社日: ${this.formatDate(employee.joinDate)}</span>
                        </div>
                        <div class="employee-actions">
                            <button class="btn btn-sm btn-primary" onclick="rushLounge.editEmployee(${employee.id})">
                                ✏️ 編集
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="rushLounge.deleteEmployee(${employee.id})">
                                🗑️ 削除
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 非アクティブ従業員リスト
        const inactiveList = document.getElementById('inactive-employees-list');
        if (inactiveList) {
            if (inactiveEmployees.length === 0) {
                inactiveList.innerHTML = '<p class="no-data">退職済み従業員はいません</p>';
            } else {
                inactiveList.innerHTML = inactiveEmployees.map(employee => `
                    <div class="employee-item inactive">
                        <div class="employee-info">
                            <strong>${employee.name}</strong>
                            <span class="employee-join-date">入社日: ${this.formatDate(employee.joinDate)}</span>
                            <span class="employee-status">（退職済み）</span>
                        </div>
                        <div class="employee-actions">
                            <button class="btn btn-sm btn-success" onclick="rushLounge.restoreEmployee(${employee.id})">
                                🔄 復活
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 統計情報
        const totalCount = document.getElementById('total-employees-count');
        const activeCount = document.getElementById('active-employees-count');
        
        if (totalCount) totalCount.textContent = `${this.data.employees.length}名`;
        if (activeCount) activeCount.textContent = `${activeEmployees.length}名`;
    }

    // 従業員選択プルダウンの更新
    updateEmployeeSelectors() {
        const activeEmployees = this.data.employees ? this.data.employees.filter(emp => emp.active) : [];
        
        // 出勤確認のプルダウン更新（カレンダーから開かれる詳細フォーム）
        const attendanceSelect = document.getElementById('quick-employee-name');
        if (attendanceSelect) {
            // フォーカス中や入力中の場合は更新をスキップ
            if (this.isFormElementInUse(attendanceSelect)) {
                console.log('🔒 従業員選択フィールドが使用中のため更新をスキップします');
                return;
            }
            
            const currentValue = attendanceSelect.value;
            attendanceSelect.innerHTML = '<option value="">従業員を選択</option>' +
                activeEmployees.map(employee => 
                    `<option value="${employee.name}">${employee.name}</option>`
                ).join('');
            
            // 以前の選択値を復元
            if (currentValue && activeEmployees.some(emp => emp.name === currentValue)) {
                attendanceSelect.value = currentValue;
            }
        }

        // 他のプルダウンも更新（必要に応じて）
        const allEmployeeSelectors = document.querySelectorAll('select[id*="employee"]');
        allEmployeeSelectors.forEach(selector => {
            if (selector.id !== 'quick-employee-name') {
                // フォーカス中や入力中の場合は更新をスキップ
                if (this.isFormElementInUse(selector)) {
                    return;
                }
                
                const currentValue = selector.value;
                selector.innerHTML = '<option value="">従業員を選択してください</option>' +
                    activeEmployees.map(employee => 
                        `<option value="${employee.name}">${employee.name}</option>`
                    ).join('');
                
                if (currentValue && activeEmployees.some(emp => emp.name === currentValue)) {
                    selector.value = currentValue;
                }
            }
        });
        
        // フォーム保護のためのイベントリスナーを設定
        this.setupFormProtection();
    }

    // データキーの取得
    getDataKey(dataType) {
        const mapping = {
            'attendance': 'attendance',
            'daily-menu': 'dailyMenu',
            'daily-menu-config': 'dailyMenuConfigs',
            'regular-menu': 'regularMenu',
            'other-menu': 'regularMenu',  // other-menuもregularMenuとして扱う
            'other-revenue': 'otherRevenue',
            'expense': 'expenses',
            'expenses': 'expenses',  // expenseとexpensesの両方に対応
            'vault': 'vaultTransactions'
        };
        return mapping[dataType] || dataType;
    }

    // 0円の項目を削除する機能を追加
    removeZeroAmountOtherRevenue() {
        const beforeCount = this.data.otherRevenue.length;
        this.data.otherRevenue = this.data.otherRevenue.filter(item => item.amount > 0);
        const afterCount = this.data.otherRevenue.length;
        
        if (beforeCount > afterCount) {
            this.saveData();
            this.updateAllDisplays();
            this.showAlert(`${beforeCount - afterCount}件の0円項目を削除しました`, 'success');
        } else {
            this.showAlert('0円の項目は見つかりませんでした', 'info');
        }
    }

    // その他メニューの統計表示を追加
    updateRegularMenuStats() {
        const statsElement = document.getElementById('regular-menu-stats');
        if (statsElement) {
            const total = this.data.regularMenu.reduce((sum, item) => {
                const amount = item.total || item.amount || (item.price * (item.quantity || 1)) || 0;
                return sum + amount;
            }, 0);
            const count = this.data.regularMenu.length;
            
            statsElement.innerHTML = `
                <div class="stats-summary">
                    <div class="stat-item">
                        <span class="stat-label">総件数:</span>
                        <span class="stat-value">${count}件</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">総売上:</span>
                        <span class="stat-value">¥${total.toLocaleString()}</span>
                    </div>
                </div>
            `;
        }
    }



    // GitHub Gist同期機能（Firebase代替）
    async setupGistSync() {
        this.gistId = localStorage.getItem('rushLoungeGistId') || null;
        this.githubToken = localStorage.getItem('rushLoungeGithubToken') || null;
        
        if (this.gistId && this.githubToken) {
            console.log('Gist同期機能を開始します');
            this.startGistSync();
        }
    }

    async createDataGist() {
        const token = prompt('GitHub Personal Access Token を入力してください:\n(Settings > Developer settings > Personal access tokens)');
        if (!token) return;

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    description: 'Rush Lounge 管理システム データ同期',
                    public: false,
                    files: {
                        'rush-lounge-data.json': {
                            content: JSON.stringify(this.data, null, 2)
                        }
                    }
                })
            });

            const gist = await response.json();
            
            if (gist.id) {
                this.gistId = gist.id;
                this.githubToken = token;
                
                localStorage.setItem('rushLoungeGistId', this.gistId);
                localStorage.setItem('rushLoungeGithubToken', this.githubToken);
                
                this.showAlert(`Gist同期が設定されました！\nGist ID: ${this.gistId}\n他プレイヤーとこのIDを共有してください`, 'success');
                this.startGistSync();
            } else {
                this.showAlert('Gist作成に失敗しました', 'error');
            }
        } catch (error) {
            console.error('Gist作成エラー:', error);
            this.showAlert('Gist作成に失敗しました', 'error');
        }
    }

    async joinGistSync() {
        const gistId = prompt('Gist ID を入力してください:');
        const token = prompt('GitHub Personal Access Token を入力してください:');
        
        if (!gistId || !token) return;

        try {
            // Gistからデータを取得
            const response = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    'Authorization': `token ${token}`
                }
            });
            
            const gist = await response.json();
            
            if (gist.files && gist.files['rush-lounge-data.json']) {
                const remoteData = JSON.parse(gist.files['rush-lounge-data.json'].content);
                
                // データをマージ
                this.mergeSharedData(remoteData);
                
                this.gistId = gistId;
                this.githubToken = token;
                
                localStorage.setItem('rushLoungeGistId', this.gistId);
                localStorage.setItem('rushLoungeGithubToken', this.githubToken);
                
                this.showAlert('Gist同期に参加しました！', 'success');
                this.startGistSync();
            } else {
                this.showAlert('Gistデータが見つかりません', 'error');
            }
        } catch (error) {
            console.error('Gist参加エラー:', error);
            this.showAlert('Gist同期への参加に失敗しました', 'error');
        }
    }

    async startGistSync() {
        if (!this.gistId || !this.githubToken) return;

        // 30秒ごとに同期
        setInterval(async () => {
            await this.syncWithGist();
        }, 30000);

        // 初回同期
        await this.syncWithGist();
    }

    async syncWithGist() {
        if (!this.gistId || !this.githubToken) return;

        try {
            // リモートデータを取得
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                headers: {
                    'Authorization': `token ${this.githubToken}`
                }
            });
            
            const gist = await response.json();
            
            if (gist.files && gist.files['rush-lounge-data.json']) {
                const remoteData = JSON.parse(gist.files['rush-lounge-data.json'].content);
                
                // データをマージ
                this.mergeSharedData(remoteData);
                
                // ローカルデータをアップロード
                await this.uploadToGist();
            }
        } catch (error) {
            console.error('Gist同期エラー:', error);
        }
    }

    async uploadToGist() {
        if (!this.gistId || !this.githubToken) return;

        try {
            await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.githubToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: {
                        'rush-lounge-data.json': {
                            content: JSON.stringify(this.data, null, 2)
                        }
                    }
                })
            });
        } catch (error) {
            console.error('Gistアップロードエラー:', error);
        }
    }

    disconnectGistSync() {
        localStorage.removeItem('rushLoungeGistId');
        localStorage.removeItem('rushLoungeGithubToken');
        this.gistId = null;
        this.githubToken = null;
        this.showAlert('Gist同期を無効化しました', 'info');
    }

    // フォーム要素が使用中かどうかを判定
    isFormElementInUse(element) {
        if (!element) return false;
        
        // フォーカス中かどうか
        if (document.activeElement === element) {
            console.log(`🔒 フォーカス中のため保護: ${element.id}`);
            return true;
        }
        
        // マウスがホバー中かどうか（セレクトボックスの場合）
        if (element.matches(':hover')) {
            console.log(`🔒 ホバー中のため保護: ${element.id}`);
            return true;
        }
        
        // セレクトボックスが開かれているかどうかを検知
        if (element.tagName === 'SELECT') {
            // セレクトボックスがクリックされた後の短期間は更新を防ぐ
            const lastInteraction = element.dataset.lastInteraction;
            if (lastInteraction) {
                const timeSinceInteraction = Date.now() - parseInt(lastInteraction);
                if (timeSinceInteraction < 5000) { // 5秒間保護（スマホ対応で延長）
                    console.log(`🔒 最近の操作のため保護: ${element.id} (${timeSinceInteraction}ms前)`);
                    return true;
                }
            }
        }
        
        // スマホでのタッチ操作保護
        if (this.isMobileDevice()) {
            const lastTouch = element.dataset.lastTouch;
            if (lastTouch) {
                const timeSinceTouch = Date.now() - parseInt(lastTouch);
                if (timeSinceTouch < 3000) { // 3秒間保護
                    console.log(`🔒 スマホタッチ操作のため保護: ${element.id} (${timeSinceTouch}ms前)`);
                    return true;
                }
            }
        }
        
        // 全体的なフォーム保護期間
        const globalFormProtection = this.globalFormProtectionUntil || 0;
        if (Date.now() < globalFormProtection) {
            console.log(`🔒 グローバルフォーム保護中: ${element.id}`);
            return true;
        }
        
        return false;
    }

    // フォーム要素の相互作用を記録
    trackFormInteraction(element) {
        if (element) {
            element.dataset.lastInteraction = Date.now().toString();
            
            // スマホの場合はタッチ操作も記録
            if (this.isMobileDevice()) {
                element.dataset.lastTouch = Date.now().toString();
            }
            
            // グローバルフォーム保護を設定（短期間）
            this.globalFormProtectionUntil = Date.now() + 1000; // 1秒間
        }
    }

    // スマホデバイスかどうかを判定
    isMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }

    // フォーム保護のためのイベントリスナー設定
    setupFormProtection() {
        // 既にリスナーが設定されている場合はスキップ
        if (this.formProtectionSetup) return;
        
        const protectedSelectors = ['#quick-employee-name'];
        
        protectedSelectors.forEach(selector => {
            const element = document.querySelector(selector);
            if (element && !element.dataset.protectionSetup) {
                // デスクトップ用イベント
                element.addEventListener('click', () => {
                    this.trackFormInteraction(element);
                    console.log('🛡️ フォーム保護: クリック検知');
                });
                
                element.addEventListener('focus', () => {
                    this.trackFormInteraction(element);
                    console.log('🛡️ フォーム保護: フォーカス検知');
                });
                
                element.addEventListener('change', () => {
                    this.trackFormInteraction(element);
                    console.log('🛡️ フォーム保護: 変更検知');
                });
                
                element.addEventListener('mouseenter', () => {
                    this.trackFormInteraction(element);
                });
                
                // スマホ用タッチイベント
                if (this.isMobileDevice()) {
                    element.addEventListener('touchstart', () => {
                        this.trackFormInteraction(element);
                        console.log('🛡️ フォーム保護: タッチ開始検知');
                    }, { passive: true });
                    
                    element.addEventListener('touchend', () => {
                        this.trackFormInteraction(element);
                        console.log('🛡️ フォーム保護: タッチ終了検知');
                    }, { passive: true });
                    
                    // スマホでのスクロール保護
                    element.addEventListener('touchmove', () => {
                        this.trackFormInteraction(element);
                    }, { passive: true });
                }
                
                // セレクトボックス特有のイベント
                if (element.tagName === 'SELECT') {
                    // セレクトボックスが開かれた時
                    element.addEventListener('mousedown', () => {
                        this.trackFormInteraction(element);
                        console.log('🛡️ フォーム保護: セレクトボックス開始');
                    });
                    
                    // キーボード操作
                    element.addEventListener('keydown', () => {
                        this.trackFormInteraction(element);
                        console.log('🛡️ フォーム保護: キーボード操作');
                    });
                }
                
                element.dataset.protectionSetup = 'true';
            }
        });
        
        this.formProtectionSetup = true;
        console.log('🛡️ フォーム保護設定完了');
    }
}

// アプリケーション初期化
let rushLounge;
document.addEventListener('DOMContentLoaded', () => {
    rushLounge = new RushLoungeManager();
    
    // 保存されたURLの読み込み
    setTimeout(() => {
        rushLounge.loadSavedUrls();
    }, 1000);
    
    // バージョン管理の初期化
    setTimeout(() => {
        initializeVersionManager();
        console.log('🔄 バージョン管理システムが初期化されました');
    }, 500);
});

// ========== グローバル関数（HTMLから呼び出し用） ==========

// GitHubリポジトリを開く
function openGitHubRepo() {
    const url = document.getElementById('github-repo-url').value.trim();
    if (!url) {
        alert('GitHubリポジトリURLを入力してください');
        return;
    }
    window.open(url, '_blank');
}

// GitHub アップロードページを開く
function openGitHubUpload() {
    const url = document.getElementById('github-repo-url').value.trim();
    if (!url) {
        alert('GitHubリポジトリURLを入力してください');
        return;
    }
    const uploadUrl = url + '/upload/main';
    window.open(uploadUrl, '_blank');
}

// 公開ページを開く
function openPublicPage() {
    const url = document.getElementById('github-pages-url').value.trim();
    if (!url) {
        alert('GitHub Pages URLを入力してください');
        return;
    }
    window.open(url, '_blank');
}

// 公開URLをコピー
function copyPublicUrl() {
    const url = document.getElementById('github-pages-url').value.trim();
    if (!url) {
        alert('GitHub Pages URLを入力してください');
        return;
    }
    
    navigator.clipboard.writeText(url).then(() => {
        alert('URLをクリップボードにコピーしました！');
    }).catch(() => {
        // フォールバック
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('URLをクリップボードにコピーしました！');
    });
}

// GitHub URL保存
function saveGitHubUrl() {
    rushLounge.saveGitHubUrl();
}

// 公開URL保存
function savePublicUrl() {
    rushLounge.savePublicUrl();
}

// デバッグ用グローバル関数
function debugImport() {
    if (rushLounge) {
        return rushLounge.debugImportListeners();
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// リスナー再設定用グローバル関数
function resetImportListeners() {
    if (rushLounge) {
        rushLounge.setupDataImportListeners();
        console.log('🔧 インポートリスナーを再設定しました');
        return 'インポートリスナーを再設定しました';
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// 手動テスト用関数
function testImport(dataType = 'other-revenue') {
    if (rushLounge) {
        console.log(`🧪 ${dataType}のインポートをテスト中...`);
        let testCSV;
        
        switch (dataType) {
            case 'attendance':
                testCSV = `日付,従業員,時間,シフト\n2024-01-01,田中太郎,09:00,朝\n2024-01-02,佐藤花子,14:00,昼`;
                break;
                         case 'daily-menu':
                 testCSV = `日付,商品1,商品2,商品3,数量,単価,合計\n2024-01-01,Rouge Oriental,Five Colours Plate,Noir Berry,1,25000,25000`;
                 break;
                         case 'regular-menu':
                 testCSV = `日付,メニュータイプ,メニュー名,数量,単価,合計\n2024-01-01,special,Special Menu,1,50000,50000\n2024-01-02,simple,Simple Menu,1,30000,30000`;
                 break;
            default:
                testCSV = `日付,金額\n2024-01-01,1000\n2024-01-02,2000`;
        }
        
        const result = rushLounge.parseCSVWithReport(testCSV, dataType);
        console.log('🧪 テスト結果:', result);
        return result;
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// 出勤確認専用テスト関数
function testAttendance() {
    if (rushLounge) {
        console.log('🧪 出勤確認のインポートテスト開始...');
        
        // 様々なヘッダー形式をテスト
        const testCases = [
            {
                name: 'パターン1: 標準形式',
                csv: `日付,従業員,時間,シフト\n2024-01-01,田中太郎,09:00,朝\n2024-01-02,佐藤花子,14:00,昼`
            },
            {
                name: 'パターン2: 英語形式',
                csv: `date,staff,time\n2024-01-01,Tanaka,09:00\n2024-01-02,Sato,14:00`
            },
            {
                name: 'パターン3: 最小形式（日付のみ）',
                csv: `日付,スタッフ\n2024-01-01,田中太郎\n2024-01-02,佐藤花子`
            },
            {
                name: 'パターン4: 異なる名称',
                csv: `出勤日,担当者,開始時間\n2024-01-01,田中太郎,09:00\n2024-01-02,佐藤花子,14:00`
            }
        ];
        
        testCases.forEach((testCase, index) => {
            console.log(`\n--- ${testCase.name} ---`);
            const result = rushLounge.parseCSVWithReport(testCase.csv, 'attendance');
            console.log(`結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
            if (!result.success) {
                console.log(`エラー: ${result.error}`);
            }
        });
        
        return 'テスト完了 - 詳細はコンソールを確認してください';
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// 日替わりメニュー専用テスト関数
function testDailyMenu() {
    if (rushLounge) {
        console.log('🧪 日替わりメニューのインポートテスト開始...');
        
        // ユーザーの実際のCSV形式をテスト
        const testCases = [
            {
                name: 'パターン1: ユーザー実データ形式',
                csv: `日付,商品1,商品2,商品3,数量,単価,合計\n2025-04-22,Rouge Oriental,Five Colours Plate,Five Colours Plate,1,25000,25000\n2025-04-23,Tropic Whisper,Night Vegigratin,Night Vegigratin,1,25000,25000`
            },
            {
                name: 'パターン2: 従来形式',
                csv: `日付,金額,1品目,2品目,3品目\n2024-01-01,25000,商品A,商品B,商品C`
            },
            {
                name: 'パターン3: 最小形式',
                csv: `日付,合計\n2024-01-01,25000\n2024-01-02,25000`
            },
            {
                name: 'パターン4: 英語形式',
                csv: `date,product1,product2,product3,quantity,price,total\n2024-01-01,Item A,Item B,Item C,1,25000,25000`
            }
        ];
        
        testCases.forEach((testCase, index) => {
            console.log(`\n--- ${testCase.name} ---`);
            const result = rushLounge.parseCSVWithReport(testCase.csv, 'daily-menu');
            console.log(`結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
            if (!result.success) {
                console.log(`エラー: ${result.error}`);
            } else {
                console.log(`インポート件数: ${result.report?.details?.successful || 0}件`);
            }
        });
        
        return 'テスト完了 - 詳細はコンソールを確認してください';
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// その他メニュー専用テスト関数
function testRegularMenu() {
    if (rushLounge) {
        console.log('🧪 その他メニューのインポートテスト開始...');
        
        // ユーザーの実際のCSV形式をテスト
        const testCases = [
            {
                name: 'パターン1: ユーザー実データ形式',
                csv: `日付,メニュータイプ,メニュー名,数量,単価,合計\n2025-04-22,special,Special Menu,1,50000,50000\n2025-04-26,simple,Simple Menu,1,30000,30000\n2025-05-17,chill,Chill Menu,1,40000,40000`
            },
            {
                name: 'パターン2: 従来形式',
                csv: `日付,コース名,金額,1品目,2品目,3品目\n2024-01-01,Simple Menu,30000,商品A,商品B,商品C`
            },
            {
                name: 'パターン3: 最小形式',
                csv: `日付,メニュー名\n2024-01-01,Special Menu\n2024-01-02,Simple Menu`
            },
            {
                name: 'パターン4: 英語形式',
                csv: `date,menutype,menu_name,quantity,price,total\n2024-01-01,special,Special Menu,1,50000,50000`
            }
        ];
        
        testCases.forEach((testCase, index) => {
            console.log(`\n--- ${testCase.name} ---`);
            const result = rushLounge.parseCSVWithReport(testCase.csv, 'regular-menu');
            console.log(`結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
            if (!result.success) {
                console.log(`エラー: ${result.error}`);
            } else {
                console.log(`インポート件数: ${result.report?.details?.successful || 0}件`);
            }
        });
        
        return 'テスト完了 - 詳細はコンソールを確認してください';
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        return 'rushLoungeが初期化されていません';
    }
}

// 出勤データの重複削除（グローバル関数）
function removeAttendanceDuplicates() {
    console.log('🔧 重複削除ボタンがクリックされました');
    
    if (rushLounge) {
        console.log('📊 rushLounge オブジェクトが見つかりました');
        console.log('📊 現在の出勤データ数:', rushLounge.data.attendance ? rushLounge.data.attendance.length : 0);
        try {
            rushLounge.removeAttendanceDuplicates();
        } catch (error) {
            console.error('❌ 重複削除処理でエラーが発生:', error);
            alert('⚠️ エラーが発生しました\n\n重複削除処理中にエラーが発生しました。\nページを再読み込みしてから再度お試しください。');
        }
    } else {
        console.error('❌ rushLoungeが初期化されていません');
        alert('⚠️ システムエラー\n\nシステムが初期化されていません。\nページを再読み込みしてください。');
    }
}

// デバッグ用：ボタンの動作確認
function testDuplicateRemoval() {
    console.log('🧪 テスト: ボタン動作確認');
    alert('✅ ボタンは正常に動作しています！\n\n重複削除機能のテストボタンをクリックしました。');
}

// ========== バージョン管理機能 ==========

// バージョン情報管理クラス
class VersionManager {
    constructor() {
        this.currentVersion = 'v1.0.0';
        this.lastUpdateDate = new Date().toISOString();
        this.updateHistory = this.getDefaultUpdateHistory();
    }

    // デフォルトのアップデート履歴
    getDefaultUpdateHistory() {
        return [
            {
                version: 'v1.0.0',
                date: new Date().toISOString(),
                type: 'major',
                description: 'Rush Lounge 経営管理システムの初期リリース',
                changes: [
                    '出勤確認システムの実装（カレンダー式、重複防止機能付き）',
                    '日替わりメニュー管理（動的商品選択、価格自動計算）',
                    'その他メニュー売上記録（Simple/Chill/Special Menu対応）',
                    '売上・収支統計機能（リアルタイム計算、利益率表示）',
                    '店舗金庫管理（自動貯金、残高追跡）',
                    'Firebase リアルタイム同期機能',
                    'コース・商品管理（原価計算、利益分析）',
                    'CSV インポート・エクスポート機能',
                    'スマホ対応レスポンシブデザイン',
                    'GitHub Pages デプロイ対応',
                    'バージョン管理システムの追加'
                ]
            }
        ];
    }

    // バージョン情報を更新
    updateVersion(newVersion, updateType, description, changes) {
        const updateRecord = {
            version: newVersion,
            date: new Date().toISOString(),
            type: updateType,
            description: description,
            changes: changes
        };

        this.updateHistory.unshift(updateRecord);
        this.currentVersion = newVersion;
        this.lastUpdateDate = updateRecord.date;
        
        // ローカルストレージに保存
        this.saveVersionData();
        
        // 表示を更新
        this.updateVersionDisplay();
        
        console.log(`🔄 バージョン更新: ${newVersion} (${updateType})`);
    }

    // バージョンデータを保存
    saveVersionData() {
        const versionData = {
            currentVersion: this.currentVersion,
            lastUpdateDate: this.lastUpdateDate,
            updateHistory: this.updateHistory
        };
        localStorage.setItem('rushLoungeVersionData', JSON.stringify(versionData));
    }

    // バージョンデータを読み込み
    loadVersionData() {
        const savedData = localStorage.getItem('rushLoungeVersionData');
        if (savedData) {
            try {
                const versionData = JSON.parse(savedData);
                this.currentVersion = versionData.currentVersion || this.currentVersion;
                this.lastUpdateDate = versionData.lastUpdateDate || this.lastUpdateDate;
                this.updateHistory = versionData.updateHistory || this.updateHistory;
            } catch (error) {
                console.error('バージョンデータの読み込みエラー:', error);
            }
        }
    }

    // バージョン情報表示を更新
    updateVersionDisplay() {
        // 現在のバージョン表示
        const currentVersionElement = document.getElementById('current-version');
        if (currentVersionElement) {
            currentVersionElement.textContent = this.currentVersion;
        }

        const lastUpdateElement = document.getElementById('last-update-date');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = this.formatDate(this.lastUpdateDate);
        }

        // フッターの更新
        const footerVersionElement = document.getElementById('footer-version');
        if (footerVersionElement) {
            footerVersionElement.textContent = this.currentVersion;
        }

        const footerUpdateElement = document.getElementById('footer-last-update');
        if (footerUpdateElement) {
            footerUpdateElement.textContent = this.formatDate(this.lastUpdateDate);
        }

        // アップデート履歴の表示
        this.displayUpdateHistory();
    }

    // アップデート履歴を表示
    displayUpdateHistory() {
        const historyContainer = document.getElementById('update-history');
        if (!historyContainer) return;

        if (this.updateHistory.length === 0) {
            historyContainer.innerHTML = '<p class="text-muted">アップデート履歴がありません。</p>';
            return;
        }

        const historyHTML = this.updateHistory.map(update => `
            <div class="update-item">
                <div class="update-header">
                    <span class="update-version">${update.version}</span>
                    <span class="update-date-display">${this.formatDate(update.date)}</span>
                </div>
                <div class="update-type ${update.type}">${this.getUpdateTypeLabel(update.type)}</div>
                <div class="update-description">${update.description}</div>
                <div class="update-changes">
                    <strong>変更内容:</strong>
                    <ul>
                        ${update.changes.map(change => `<li>${change}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `).join('');

        historyContainer.innerHTML = historyHTML;
    }

    // アップデートタイプのラベル取得
    getUpdateTypeLabel(type) {
        const labels = {
            'major': 'メジャー',
            'minor': 'マイナー',
            'patch': 'パッチ',
            'hotfix': 'ホットフィックス'
        };
        return labels[type] || type;
    }

    // 日付フォーマット
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 初期化
    init() {
        this.loadVersionData();
        this.updateVersionDisplay();
    }
}

// グローバルバージョンマネージャー
let versionManager;

// バージョン管理の初期化
function initializeVersionManager() {
    versionManager = new VersionManager();
    versionManager.init();
}

// 新しいアップデートを記録（開発者用）
function recordUpdate(version, type, description, changes) {
    if (versionManager) {
        versionManager.updateVersion(version, type, description, changes);
        alert(`✅ バージョン ${version} を記録しました！`);
    } else {
        alert('⚠️ バージョンマネージャーが初期化されていません。');
    }
}

// アップデート例を追加（デモ用）
function addSampleUpdate() {
    if (versionManager) {
        const sampleUpdates = [
            {
                version: 'v1.0.1',
                type: 'patch',
                description: 'バグ修正とパフォーマンス改善',
                changes: [
                    'スマホでの出勤確認重複記録問題を修正',
                    'Firebase同期時の競合解決機能を改善',
                    'フォーム入力時の自動リセット問題を修正',
                    'バージョン管理システムの追加'
                ]
            },
            {
                version: 'v1.1.0',
                type: 'minor',
                description: '新機能追加とユーザビリティ改善',
                changes: [
                    '週間出勤統計にボーナス計算機能を追加',
                    'メニュー管理に動的選択肢機能を実装',
                    'データ削除時の安全性を向上',
                    'CSVインポート機能の自動判定を強化',
                    'レスポンシブデザインの最適化'
                ]
            }
        ];

        const randomUpdate = sampleUpdates[Math.floor(Math.random() * sampleUpdates.length)];
        versionManager.updateVersion(
            randomUpdate.version,
            randomUpdate.type,
            randomUpdate.description,
            randomUpdate.changes
        );
        alert(`✅ サンプルアップデート ${randomUpdate.version} を追加しました！`);
    } else {
        alert('⚠️ バージョンマネージャーが初期化されていません。');
    }
}

// バージョン情報をリセット（開発者用）
function resetVersionData() {
    if (confirm('⚠️ 確認\n\nバージョン情報をリセットしますか？\nこの操作は元に戻せません。')) {
        localStorage.removeItem('rushLoungeVersionData');
        if (versionManager) {
            versionManager.currentVersion = 'v1.0.0';
            versionManager.lastUpdateDate = new Date().toISOString();
            versionManager.updateHistory = versionManager.getDefaultUpdateHistory();
            versionManager.updateVersionDisplay();
        }
        alert('✅ バージョン情報をリセットしました。');
    }
}

// デバッグ用：バージョン情報確認
function debugVersionInfo() {
    if (versionManager) {
        console.log('📊 現在のバージョン情報:');
        console.log('バージョン:', versionManager.currentVersion);
        console.log('最終更新:', versionManager.lastUpdateDate);
        console.log('履歴件数:', versionManager.updateHistory.length);
        console.log('履歴:', versionManager.updateHistory);
        return {
            version: versionManager.currentVersion,
            lastUpdate: versionManager.lastUpdateDate,
            historyCount: versionManager.updateHistory.length,
            history: versionManager.updateHistory
        };
    } else {
        console.error('❌ バージョンマネージャーが初期化されていません');
        return null;
    }
}