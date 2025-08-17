class IPTVPlayer {
    constructor() {
        this.channels = [];
        this.filteredChannels = [];
        this.categories = new Set();
        this.currentChannel = null;
        this.hls = null;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadChannels();
        this.setupCategories();
        this.renderChannels();
    }

    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchBtn.addEventListener('click', () => this.handleSearch(searchInput.value));
        
        // Player controls
        const closePlayer = document.getElementById('closePlayer');
        closePlayer.addEventListener('click', () => this.closePlayer());
        
        // Category filtering
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                this.handleCategoryFilter(e.target.dataset.category);
            }
        });
    }

    async loadChannels() {
        try {
            const response = await fetch('https://iptv-org.github.io/iptv/index.m3u');
            const m3uContent = await response.text();
            this.parseM3U(m3uContent);
        } catch (error) {
            console.error('Error loading channels:', error);
            this.showError('Failed to load channels. Please try again later.');
        }
    }

    parseM3U(content) {
        const lines = content.split('\n');
        const channels = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                const channelInfo = this.parseChannelInfo(line);
                const url = lines[i + 1]?.trim();
                
                if (url && !url.startsWith('#')) {
                    channels.push({
                        ...channelInfo,
                        url: url
                    });
                    
                    // Add category to set
                    if (channelInfo.groupTitle && channelInfo.groupTitle !== 'Undefined') {
                        this.categories.add(channelInfo.groupTitle);
                    }
                }
            }
        }
        
        this.channels = channels;
        this.filteredChannels = [...channels];
        console.log(`Loaded ${channels.length} channels`);
    }

    parseChannelInfo(extinfLine) {
        const info = {};
        
        // Extract tvg-id
        const tvgIdMatch = extinfLine.match(/tvg-id="([^"]*)"/);
        info.tvgId = tvgIdMatch ? tvgIdMatch[1] : '';
        
        // Extract tvg-logo
        const tvgLogoMatch = extinfLine.match(/tvg-logo="([^"]*)"/);
        info.tvgLogo = tvgLogoMatch ? tvgLogoMatch[1] : '';
        
        // Extract group-title
        const groupTitleMatch = extinfLine.match(/group-title="([^"]*)"/);
        info.groupTitle = groupTitleMatch ? groupTitleMatch[1] : 'General';
        
        // Extract channel name and quality
        const nameMatch = extinfLine.match(/,(.+)$/);
        if (nameMatch) {
            const fullName = nameMatch[1];
            const qualityMatch = fullName.match(/\((\d+p)\)/);
            info.name = fullName.replace(/\(\d+p\)/, '').trim();
            info.quality = qualityMatch ? qualityMatch[1] : '';
        }
        
        return info;
    }

    setupCategories() {
        const categoryList = document.getElementById('categoryList');
        
        // Clear existing categories (except "All Channels")
        const allChannelsBtn = categoryList.querySelector('[data-category="all"]');
        categoryList.innerHTML = '';
        categoryList.appendChild(allChannelsBtn);
        
        // Add category buttons
        const sortedCategories = Array.from(this.categories).sort();
        sortedCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.dataset.category = category;
            btn.textContent = category;
            categoryList.appendChild(btn);
        });
    }

    handleCategoryFilter(category) {
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Filter channels
        if (category === 'all') {
            this.filteredChannels = [...this.channels];
        } else {
            this.filteredChannels = this.channels.filter(channel => 
                channel.groupTitle === category
            );
        }
        
        this.renderChannels();
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.filteredChannels = [...this.channels];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredChannels = this.channels.filter(channel =>
                channel.name.toLowerCase().includes(searchTerm) ||
                channel.groupTitle.toLowerCase().includes(searchTerm)
            );
        }
        
        this.renderChannels();
    }

    renderChannels() {
        const grid = document.getElementById('channelsGrid');
        
        if (this.filteredChannels.length === 0) {
            grid.innerHTML = `
                <div class="error">
                    <i class="fas fa-search"></i>
                    <p>No channels found matching your search.</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = this.filteredChannels.map(channel => this.createChannelCard(channel)).join('');
        
        // Add click events to channel cards
        document.querySelectorAll('.channel-card').forEach((card, index) => {
            card.addEventListener('click', () => this.playChannel(this.filteredChannels[index]));
        });
    }

    createChannelCard(channel) {
        const logo = channel.tvgLogo || '';
        const logoHtml = logo ? 
            `<img src="${logo}" alt="${channel.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : '';
        
        return `
            <div class="channel-card">
                <div class="channel-logo">
                    ${logoHtml}
                    <i class="fas fa-tv" style="display: ${logo ? 'none' : 'flex'};"></i>
                </div>
                <div class="channel-name">${channel.name}</div>
                <div class="channel-category">${channel.groupTitle}</div>
                ${channel.quality ? `<div class="channel-quality">${channel.quality}</div>` : ''}
            </div>
        `;
    }

    async playChannel(channel) {
        try {
            this.currentChannel = channel;
            
            // Show player section
            const playerSection = document.getElementById('playerSection');
            const channelsGrid = document.getElementById('channelsGrid');
            
            playerSection.style.display = 'block';
            channelsGrid.style.display = 'none';
            
            // Update channel name
            document.getElementById('currentChannelName').textContent = channel.name;
            
            // Setup video player
            const video = document.getElementById('videoPlayer');
            video.src = channel.url;
            
            // Handle HLS streams
            if (channel.url.includes('.m3u8')) {
                if (Hls.isSupported()) {
                    this.hls = new Hls();
                    this.hls.loadSource(channel.url);
                    this.hls.attachMedia(video);
                    
                    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play().catch(e => console.log('Auto-play prevented:', e));
                    });
                    
                    this.hls.on(Hls.Events.ERROR, (event, data) => {
                        console.error('HLS error:', data);
                        this.showStreamError();
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS support (Safari)
                    video.play().catch(e => console.log('Auto-play prevented:', e));
                } else {
                    this.showStreamError();
                }
            } else {
                // Direct video stream
                video.play().catch(e => console.log('Auto-play prevented:', e));
            }
            
        } catch (error) {
            console.error('Error playing channel:', error);
            this.showStreamError();
        }
    }

    closePlayer() {
        // Stop HLS if active
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        
        // Stop video
        const video = document.getElementById('videoPlayer');
        video.pause();
        video.src = '';
        
        // Hide player and show channels
        const playerSection = document.getElementById('playerSection');
        const channelsGrid = document.getElementById('channelsGrid');
        
        playerSection.style.display = 'none';
        channelsGrid.style.display = 'grid';
        
        this.currentChannel = null;
    }

    showStreamError() {
        const playerSection = document.getElementById('playerSection');
        playerSection.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Unable to play this stream. The channel may be offline or geo-blocked.</p>
                <button onclick="iptvPlayer.closePlayer()" class="close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }

    showError(message) {
        const grid = document.getElementById('channelsGrid');
        grid.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// Initialize the IPTV player when the page loads
let iptvPlayer;
document.addEventListener('DOMContentLoaded', () => {
    iptvPlayer = new IPTVPlayer();
});
