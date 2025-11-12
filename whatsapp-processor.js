/**
 * Procesador de Conversaciones de WhatsApp
 * Mantiene toda la funcionalidad original pero organizada en una clase
 */

class WhatsAppProcessorUI {
    constructor() {
        this.processedData = [];
        this.imageFiles = new Map();
        this.currentFileType = 'text';
        this.draggedItem = null;
        this.dragStartIndex = null;
        this.isEditingTitle = false;
        this.currentTitle = 'Resultados del procesamiento';
        this.filteredData = [];

        this.enhancedPatterns = {
            dateFormats: [
                /\[\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2}\]/,
                /\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2} -/,
                /\d{1,2}\.\d{1,2}\.\d{4}, \d{1,2}:\d{2}/,
                /\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2} [a|p]\. m\./,
                /\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}\s?[ap]m/,
                /\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2}\s?[ap]m/,
            ],
            mediaPatterns: [
                /<adjunto:\s*(.*?)>/i,
                /(IMG-\d{8}-WA\d{4}\.(jpg|jpeg|png|gif|bmp|webp))/i,
                /(VID-\d{8}-WA\d{4}\.(mp4|mov|avi))/i,
                /(AUD-\d{8}-WA\d{4}\.(mp3|m4a|opus))/i,
                /(PTT-\d{8}-WA\d{4}\.(opus|ogg))/i,
                /(STK-\d{8}-WA\d{4}\.(webp|png))/i,
            ]
        };

        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Elementos del DOM
        this.tabs = document.querySelectorAll('.tab');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.textFileInput = document.getElementById('textFileInput');
        this.zipFileInput = document.getElementById('zipFileInput');
        this.textFileName = document.getElementById('textFileName');
        this.zipFileName = document.getElementById('zipFileName');
        this.processBtn = document.getElementById('processBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.resultsSection = document.getElementById('resultsSection');
        this.imagesContainer = document.getElementById('imagesContainer');
        this.exportCsvBtn = document.getElementById('exportCsvBtn');
        this.exportPdfBtn = document.getElementById('exportPdfBtn');
        this.statsInfo = document.getElementById('statsInfo');
        this.reportTitle = document.getElementById('reportTitle');
        this.editTitleBtn = document.getElementById('editTitleBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progress = document.getElementById('progress');
        this.fileStats = document.getElementById('fileStats');
        this.debugInfo = document.getElementById('debugInfo');
        this.reorderHint = document.getElementById('reorderHint');
        this.searchFilterBar = document.getElementById('searchFilterBar');
        this.searchInput = document.getElementById('searchInput');
        this.fileFilter = document.getElementById('fileFilter');
        this.clearFilters = document.getElementById('clearFilters');
        this.batchInfo = document.getElementById('batchInfo');
    }

    attachEventListeners() {
        // Manejo de pestañas
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                this.tabs.forEach(t => t.classList.remove('active'));
                this.tabContents.forEach(tc => tc.classList.remove('active'));
                
                tab.classList.add('active');
                document.getElementById(tabId).classList.add('active');
                
                this.currentFileType = tabId === 'text-tab' ? 'text' : 'zip';
                this.updateProcessButtonState();
            });
        });

        // Manejo de archivos
        this.textFileInput.addEventListener('change', () => this.handleFileInput('text'));
        this.zipFileInput.addEventListener('change', () => this.handleFileInput('zip'));

        // Botones de acción
        this.processBtn.addEventListener('click', () => this.processFile());
        this.exportCsvBtn.addEventListener('click', () => this.exportToCSV(this.processedData));
        this.exportPdfBtn.addEventListener('click', () => this.exportToPDF(this.processedData));
        this.editTitleBtn.addEventListener('click', () => this.toggleTitleEdit());
        this.reportTitle.addEventListener('click', () => {
            if (!this.isEditingTitle) this.startEditingTitle();
        });

        // Filtros
        this.searchInput.addEventListener('input', () => this.filterResults());
        this.fileFilter.addEventListener('change', () => this.filterResults());
        this.clearFilters.addEventListener('click', () => this.clearAllFilters());
    }

    handleFileInput(type) {
        const input = type === 'text' ? this.textFileInput : this.zipFileInput;
        const fileNameDisplay = type === 'text' ? this.textFileName : this.zipFileName;

        if (input.files && input.files.length > 0) {
            try {
                this.validateFile(input.files[0], type);
                fileNameDisplay.textContent = input.files[0].name;
                fileNameDisplay.style.color = '#666';
            } catch (error) {
                fileNameDisplay.textContent = error.message;
                fileNameDisplay.style.color = 'var(--error-color)';
                input.value = '';
            }
        } else {
            fileNameDisplay.textContent = 'No se ha seleccionado ningún archivo';
            fileNameDisplay.style.color = '#666';
        }
        this.updateProcessButtonState();
    }

    validateFile(file, type) {
        const maxSize = type === 'zip' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
        const allowedTypes = {
            text: ['text/plain', 'application/octet-stream'],
            zip: ['application/zip', 'application/x-zip-compressed']
        };

        if (file.size > maxSize) {
            throw new Error(`El archivo es demasiado grande. Tamaño máximo: ${maxSize / 1024 / 1024}MB`);
        }

        if (!allowedTypes[type].includes(file.type) && !file.name.match(type === 'text' ? /\.txt$/i : /\.zip$/i)) {
            throw new Error(`Tipo de archivo no válido. Se esperaba un archivo ${type.toUpperCase()}`);
        }

        return true;
    }

    updateProcessButtonState() {
        let hasFile = false;
        
        if (this.currentFileType === 'text') {
            hasFile = this.textFileInput.files && this.textFileInput.files.length > 0;
        } else {
            hasFile = this.zipFileInput.files && this.zipFileInput.files.length > 0;
        }
        
        this.processBtn.disabled = !hasFile;
    }

    async processFile() {
        let file;
        
        if (this.currentFileType === 'text') {
            if (!this.textFileInput.files || this.textFileInput.files.length === 0) {
                alert('Por favor, selecciona un archivo de texto primero.');
                return;
            }
            file = this.textFileInput.files[0];
        } else {
            if (!this.zipFileInput.files || this.zipFileInput.files.length === 0) {
                alert('Por favor, selecciona un archivo ZIP primero.');
                return;
            }
            file = this.zipFileInput.files[0];
        }
        
        this.loadingIndicator.style.display = 'block';
        this.progressBar.style.display = 'block';
        this.resultsSection.style.display = 'none';
        this.imagesContainer.innerHTML = '';
        this.imageFiles.clear();
        this.processedData = [];
        this.debugInfo.style.display = 'none';
        this.batchInfo.style.display = 'none';
        this.searchFilterBar.style.display = 'none';
        
        try {
            if (this.currentFileType === 'text') {
                this.processedData = await this.processTextFile(file);
            } else {
                const result = await this.processZipFile(file);
                this.processedData = result.data;
                this.imageFiles = result.images;
            }
            
            this.displayResults(this.processedData);
            
            this.loadingIndicator.style.display = 'none';
            this.progressBar.style.display = 'none';
            this.resultsSection.style.display = 'block';
            
            this.enhanceAccessibility();
        } catch (error) {
            this.loadingIndicator.style.display = 'none';
            this.progressBar.style.display = 'none';
            this.showError('Error al procesar el archivo: ' + error.message);
            console.error(error);
        }
    }

    processTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    this.updateProgress('processing', 50, 'Procesando contenido del archivo...');
                    
                    const fileContent = e.target.result;
                    const results = this.processWhatsAppFile(fileContent, file.name);
                    
                    this.updateProgress('processing', 100, `Procesado: ${file.name} - ${results.length} imágenes encontradas`);
                    
                    resolve(results);
                } catch (error) {
                    const errorInfo = this.handleProcessingError(error, 'processTextFile');
                    reject(new Error(errorInfo.error));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Error al leer el archivo.'));
            };
            
            reader.readAsText(file, 'UTF-8');
        });
    }

    async processZipFile(zipFile) {
        try {
            this.updateProgress('loading', 10, 'Cargando archivo ZIP...');
            
            if (typeof JSZip === 'undefined') {
                throw new Error('JSZip no está disponible. Asegúrate de incluir la librería JSZip.');
            }

            const zip = await JSZip.loadAsync(zipFile);
            const allResults = [];
            const imageMap = new Map();
            
            // Obtener todos los archivos
            const fileEntries = [];
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir) {
                    fileEntries.push({ path: relativePath, entry: zipEntry });
                }
            });
            
            this.updateProgress('loading', 20, `Encontrados ${fileEntries.length} archivos en el ZIP`);
            
            // Extraer todas las imágenes
            const imagePromises = [];
            let imageCount = 0;
            
            for (const fileEntry of fileEntries) {
                const fileName = fileEntry.path.split('/').pop();
                if (fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
                    imageCount++;
                    imagePromises.push(
                        fileEntry.entry.async('blob').then(blob => {
                            const imageUrl = URL.createObjectURL(blob);
                            imageMap.set(fileName, {
                                url: imageUrl,
                                blob: blob,
                                originalName: fileName
                            });
                            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                            imageMap.set(nameWithoutExt, {
                                url: imageUrl,
                                blob: blob,
                                originalName: fileName
                            });
                        })
                    );
                }
            }
            
            this.updateProgress('extracting', 30, `Extrayendo ${imageCount} imágenes...`);
            
            if (imagePromises.length > 0) {
                await Promise.all(imagePromises);
            }
            
            this.updateProgress('extracting', 40, `${imageCount} imágenes extraídas, buscando archivos de texto...`);
            
            // Procesar archivos de texto
            const textFileEntries = fileEntries.filter(fileEntry => {
                const fileName = fileEntry.path.split('/').pop();
                const lowerName = fileName.toLowerCase();
                
                return lowerName.endsWith('.txt') || 
                       lowerName.endsWith('.text') ||
                       !fileName.includes('.') ||
                       lowerName.includes('chat') ||
                       lowerName.includes('whatsapp') ||
                       lowerName.includes('conversation');
            });
            
            if (textFileEntries.length === 0) {
                throw new Error('No se encontraron archivos de texto procesables en el ZIP.');
            }
            
            // Procesar en lotes
            const batchSize = 5;
            const batches = [];
            for (let i = 0; i < textFileEntries.length; i += batchSize) {
                batches.push(textFileEntries.slice(i, i + batchSize));
            }
            
            this.batchInfo.style.display = 'block';
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchProgress = ((i / batches.length) * 40) + 40;
                
                this.updateProgress('processing', batchProgress, 
                    `Procesando lote ${i + 1}/${batches.length} (${batch.length} archivos)...`);
                
                this.batchInfo.textContent = `Procesando lote ${i + 1} de ${batches.length}: ${batch.map(f => f.path.split('/').pop()).join(', ')}`;
                
                const batchPromises = batch.map(fileEntry => 
                    fileEntry.entry.async('text').then(content => {
                        const results = this.processWhatsAppFile(content, fileEntry.path);
                        return { results, fileName: fileEntry.path };
                    }).catch(error => {
                        console.warn(`No se pudo procesar ${fileEntry.path} como texto:`, error);
                        return { results: [], fileName: fileEntry.path };
                    })
                );
                
                const batchResults = await Promise.all(batchPromises);
                
                batchResults.forEach(({results, fileName}) => {
                    if (results.length > 0) {
                        allResults.push(...results);
                    }
                });
                
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.updateProgress('complete', 100, `Procesados ${textFileEntries.length} archivos - ${allResults.length} imágenes encontradas en total`);
            this.batchInfo.style.display = 'none';
            
            return {
                data: allResults,
                images: imageMap
            };
        } catch (error) {
            const errorInfo = this.handleProcessingError(error, 'processZipFile');
            throw new Error('Error al procesar el archivo ZIP: ' + errorInfo.error);
        }
    }

    processWhatsAppFile(content, fileName = 'desconocido') {
        console.log(`Procesando archivo: ${fileName}`);
        
        if (content.length > 1000000) {
            return this.processLargeFileInBatches(content, 5000, fileName);
        }
        
        const lines = content.split('\n');
        const results = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            let mediaMatches = [];
            this.enhancedPatterns.mediaPatterns.forEach(pattern => {
                const matches = line.match(pattern);
                if (matches) {
                    mediaMatches = mediaMatches.concat(matches.filter(m => m && !m.startsWith('<') && !m.endsWith('>')));
                }
            });
            
            if (mediaMatches.length > 0) {
                mediaMatches.forEach(mediaName => {
                    let comment = 'Sin comentarios';
                    let commentFound = false;
                    
                    const lineAfterMedia = line.split(mediaName)[1]?.trim();
                    if (lineAfterMedia && !this.isSystemMessage(lineAfterMedia) && !this.isDateLine(lineAfterMedia)) {
                        comment = lineAfterMedia;
                        commentFound = true;
                    }
                    
                    if (!commentFound && i < lines.length - 1) {
                        const nextLine = lines[i + 1].trim();
                        if (nextLine && !this.isSystemMessage(nextLine) && !this.isDateLine(nextLine) && 
                            !this.enhancedPatterns.mediaPatterns.some(p => p.test(nextLine))) {
                            comment = nextLine;
                            commentFound = true;
                        }
                    }
                    
                    if (!commentFound && i > 0) {
                        const prevLine = lines[i - 1].trim();
                        if (prevLine && !this.isSystemMessage(prevLine) && !this.isDateLine(prevLine) && 
                            !this.enhancedPatterns.mediaPatterns.some(p => p.test(prevLine))) {
                            comment = prevLine;
                            commentFound = true;
                        }
                    }
                    
                    if (this.isSystemMessage(comment) || !comment.trim()) {
                        comment = 'Sin comentarios';
                    }
                    
                    results.push({
                        imageName: mediaName,
                        comment: comment,
                        sourceFile: fileName,
                        lineNumber: i + 1
                    });
                });
            }
        }
        
        console.log(`Archivo ${fileName}: ${results.length} medios encontrados`);
        
        this.debugInfo.style.display = 'block';
        this.debugInfo.innerHTML = `
            <strong>Información de depuración:</strong><br>
            Archivo: ${fileName}<br>
            Líneas procesadas: ${lines.length}<br>
            Medios encontrados: ${results.length}<br>
            <small>Ejemplos encontrados:<br>
            ${results.slice(0, 5).map(r => `• ${r.imageName} → "${r.comment}" (línea ${r.lineNumber})`).join('<br>')}
            </small>
        `;
        
        return results;
    }

    isSystemMessage(line) {
        const systemKeywords = [
            'creó el grupo', 'añadió', 'Mensajes y las llamadas están cifrados',
            'Se eliminó este mensaje', 'Se editó este mensaje', 'cambió el asunto',
            'cambió la descripción', 'cambió el ícono', 'salió del grupo',
            'left the group', 'created the group', 'added', 
            'Messages and calls are encrypted', 'cambió tu código de seguridad',
            'Los mensajes y las llamadas están cifrados', 'Obtén más información',
            'salió de este grupo', 'eliminó a', 'changed the subject',
            'changed this group\'s icon', 'changed the description',
            'archivo adjunto', 'omitido', 'Security code changed',
            'You deleted this message', 'This message was deleted',
            'missed voice call', 'missed video call'
        ];
        
        return systemKeywords.some(keyword => 
            line.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    isDateLine(line) {
        return this.enhancedPatterns.dateFormats.some(pattern => pattern.test(line));
    }

    processLargeFileInBatches(content, batchSize = 5000, fileName = 'desconocido') {
        const lines = content.split('\n');
        const batches = [];
        
        for (let i = 0; i < lines.length; i += batchSize) {
            batches.push(lines.slice(i, i + batchSize));
        }
        
        const allResults = [];
        
        this.batchInfo.style.display = 'block';
        this.batchInfo.textContent = `Procesando archivo grande en ${batches.length} lotes...`;
        
        for (let i = 0; i < batches.length; i++) {
            const batchLines = batches[i];
            const batchStartLine = i * batchSize;
            const batchResults = this.processBatch(batchLines, batchStartLine, fileName);
            allResults.push(...batchResults);
            
            this.batchInfo.textContent = `Procesando lote ${i + 1}/${batches.length} (${batchResults.length} medios encontrados)...`;
        }
        
        this.batchInfo.style.display = 'none';
        return allResults;
    }

    processBatch(lines, startLine, fileName) {
        const results = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const imagePattern = /IMG-\d{8}-WA\d{4}\.(jpg|jpeg|png|gif|bmp|webp)/gi;
            const imageMatches = line.match(imagePattern);
            
            if (imageMatches) {
                imageMatches.forEach(imageName => {
                    let comment = 'Sin comentarios';
                    let commentFound = false;
                    
                    const lineAfterImage = line.split(imageName)[1]?.trim();
                    if (lineAfterImage && !this.isSystemMessage(lineAfterImage) && !this.isDateLine(lineAfterImage)) {
                        comment = lineAfterImage;
                        commentFound = true;
                    }
                    
                    if (!commentFound && i < lines.length - 1) {
                        const nextLine = lines[i + 1].trim();
                        if (nextLine && !this.isSystemMessage(nextLine) && !this.isDateLine(nextLine) && !nextLine.match(imagePattern)) {
                            comment = nextLine;
                            commentFound = true;
                        }
                    }
                    
                    if (this.isSystemMessage(comment) || !comment.trim()) {
                        comment = 'Sin comentarios';
                    }
                    
                    results.push({
                        imageName: imageName,
                        comment: comment,
                        sourceFile: fileName,
                        lineNumber: startLine + i + 1
                    });
                });
            }
        }
        
        return results;
    }

    handleProcessingError(error, context) {
        console.error(`Error en ${context}:`, error);
        
        const errorInfo = {
            timestamp: new Date().toISOString(),
            context: context,
            error: error.message,
            stack: error.stack
        };
        
        try {
            const existingErrors = JSON.parse(localStorage.getItem('whatsappProcessorErrors') || '[]');
            existingErrors.push(errorInfo);
            localStorage.setItem('whatsappProcessorErrors', JSON.stringify(existingErrors.slice(-10)));
        } catch (e) {
            console.warn('No se pudieron guardar los errores en localStorage:', e);
        }
        
        return errorInfo;
    }

    updateProgress(stage, percentage, message) {
        this.progress.style.width = `${percentage}%`;
        this.fileStats.textContent = message;
        
        if (percentage < 30) {
            this.progress.style.backgroundColor = '#e74c3c';
        } else if (percentage < 70) {
            this.progress.style.backgroundColor = '#f39c12';
        } else {
            this.progress.style.backgroundColor = '#25D366';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <strong>Error:</strong> ${message}
            <br><small>Consulta la consola para más detalles.</small>
        `;
        
        document.querySelector('.upload-section').appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
    }

    displayResults(data) {
        this.imagesContainer.innerHTML = '';
        this.filteredData = [...data];
        
        if (data.length === 0) {
            this.imagesContainer.innerHTML = '<div class="no-results">No se encontraron imágenes en el archivo</div>';
            this.statsInfo.textContent = 'No se encontraron imágenes para procesar.';
            this.reorderHint.style.display = 'none';
            this.searchFilterBar.style.display = 'none';
            return;
        }
        
        const uniqueData = [];
        const seenImages = new Set();
        
        data.forEach(item => {
            if (!seenImages.has(item.imageName)) {
                seenImages.add(item.imageName);
                uniqueData.push(item);
            }
        });
        
        this.processedData = uniqueData;
        this.filteredData = [...uniqueData];
        
        this.filteredData.forEach((item, index) => {
            const imageCard = this.createImageCard(item, index);
            this.imagesContainer.appendChild(imageCard);
        });
        
        this.statsInfo.textContent = `Se encontraron ${uniqueData.length} imágenes únicas en total (de ${data.length} detectadas). Arrastra para reordenar o haz clic en × para eliminar.`;
        
        if (uniqueData.length > 1) {
            this.reorderHint.style.display = 'block';
        } else {
            this.reorderHint.style.display = 'none';
        }
        
        this.searchFilterBar.style.display = 'flex';
        this.setupSearchAndFilter(uniqueData);
        
        this.initializeSimpleDragAndDrop();
    }

    setupSearchAndFilter(data) {
        this.fileFilter.innerHTML = '<option value="all">Todos los archivos</option>';
        
        const uniqueFiles = [...new Set(data.map(item => item.sourceFile))];
        uniqueFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file.split('/').pop();
            this.fileFilter.appendChild(option);
        });
    }

    filterResults() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const selectedFile = this.fileFilter.value;
        
        this.filteredData = this.processedData.filter(item => {
            const matchesSearch = searchTerm === '' || 
                                item.comment.toLowerCase().includes(searchTerm) ||
                                item.imageName.toLowerCase().includes(searchTerm);
            
            const matchesFile = selectedFile === 'all' || item.sourceFile === selectedFile;
            
            return matchesSearch && matchesFile;
        });
        
        this.imagesContainer.innerHTML = '';
        
        if (this.filteredData.length === 0) {
            this.imagesContainer.innerHTML = '<div class="no-results">No se encontraron resultados para los filtros aplicados</div>';
        } else {
            this.filteredData.forEach((item, index) => {
                const imageCard = this.createImageCard(item, index);
                this.imagesContainer.appendChild(imageCard);
            });
            
            this.initializeSimpleDragAndDrop();
        }
        
        this.statsInfo.textContent = `Mostrando ${this.filteredData.length} de ${this.processedData.length} imágenes`;
    }

    clearAllFilters() {
        this.searchInput.value = '';
        this.fileFilter.value = 'all';
        this.filterResults();
    }

    createImageCard(item, index) {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.setAttribute('data-index', index);
        imageCard.draggable = true;
        
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '↕';
        dragHandle.title = 'Arrastrar para reordenar';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Eliminar imagen';
        deleteBtn.addEventListener('click', () => {
            const cardIndex = this.filteredData.findIndex(d => d.imageName === item.imageName);
            if (cardIndex !== -1) {
                const originalIndex = this.processedData.findIndex(d => d.imageName === item.imageName);
                if (originalIndex !== -1) {
                    this.processedData.splice(originalIndex, 1);
                }
                this.filteredData.splice(cardIndex, 1);
                this.displayResults(this.processedData);
            }
        });
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'image-container';
        
        const img = document.createElement('img');
        img.alt = item.imageName;
        
        let imageFound = false;
        if (this.imageFiles.has(item.imageName)) {
            img.src = this.imageFiles.get(item.imageName).url;
            imageFound = true;
        } else {
            const nameWithoutExt = item.imageName.replace(/\.[^/.]+$/, "");
            if (this.imageFiles.has(nameWithoutExt)) {
                img.src = this.imageFiles.get(nameWithoutExt).url;
                imageFound = true;
            }
        }
        
        if (!imageFound) {
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik03NSA1MEgxMjVWMTUwSDc1VjUwWiIgZmlsbD0iI0RDRTBFNiIvPgo8cGF0aCBkPSJNODUgMTEwVjg1SDEwNVYxMTBIOThWOTVIOThWMTEwSDg1WiIgZmlsbD0iIzlBQUFCMSIvPgo8L3N2Zz4K';
        }
        
        const imageInfo = document.createElement('div');
        imageInfo.className = 'image-info';
        
        const imageName = document.createElement('div');
        imageName.className = 'image-name';
        imageName.textContent = item.imageName;
        imageName.title = `Archivo origen: ${item.sourceFile} (línea ${item.lineNumber})`;
        
        const commentInput = document.createElement('input');
        commentInput.type = 'text';
        commentInput.className = 'comment-input';
        commentInput.placeholder = 'Comentario asociado...';
        commentInput.value = item.comment;
        commentInput.id = `comment-${index}`;
        
        commentInput.addEventListener('change', function() {
            item.comment = this.value;
        });
        
        commentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur();
            }
        });
        
        imageContainer.appendChild(img);
        imageInfo.appendChild(imageName);
        imageInfo.appendChild(commentInput);
        imageCard.appendChild(dragHandle);
        imageCard.appendChild(deleteBtn);
        imageCard.appendChild(imageContainer);
        imageCard.appendChild(imageInfo);
        
        return imageCard;
    }

    initializeSimpleDragAndDrop() {
        const cards = document.querySelectorAll('.image-card');
        
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e, card));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));
            card.addEventListener('dragover', (e) => this.handleDragOver(e));
            card.addEventListener('dragenter', (e) => this.handleDragEnter(e, card));
            card.addEventListener('dragleave', (e) => this.handleDragLeave(e, card));
            card.addEventListener('drop', (e) => this.handleDrop(e, card));
        });
    }

    handleDragStart(e, card) {
        this.draggedItem = card;
        this.dragStartIndex = parseInt(card.getAttribute('data-index'));
        card.classList.add('dragging');
        
        e.dataTransfer.setData('text/plain', this.dragStartIndex);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragEnd(e, card) {
        card.classList.remove('dragging');
        this.draggedItem = null;
        this.dragStartIndex = null;
        
        document.querySelectorAll('.image-card').forEach(card => {
            card.style.border = '';
            card.style.background = '';
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        if (this.draggedItem) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    handleDragEnter(e, card) {
        e.preventDefault();
        if (this.draggedItem && card !== this.draggedItem) {
            card.style.border = '2px solid var(--primary-color)';
            card.style.background = 'rgba(37, 211, 102, 0.05)';
        }
    }

    handleDragLeave(e, card) {
        if (this.draggedItem && card !== this.draggedItem) {
            if (!card.contains(e.relatedTarget)) {
                card.style.border = '';
                card.style.background = '';
            }
        }
    }

    handleDrop(e, card) {
        e.preventDefault();
        
        card.style.border = '';
        card.style.background = '';
        
        if (this.draggedItem && card !== this.draggedItem) {
            const dragEndIndex = parseInt(card.getAttribute('data-index'));
            
            if (this.dragStartIndex !== null && dragEndIndex !== null && this.dragStartIndex !== dragEndIndex) {
                const itemToMove = this.filteredData[this.dragStartIndex];
                this.filteredData.splice(this.dragStartIndex, 1);
                this.filteredData.splice(dragEndIndex, 0, itemToMove);
                
                const originalItemIndex = this.processedData.findIndex(item => item.imageName === itemToMove.imageName);
                if (originalItemIndex !== -1) {
                    const originalItem = this.processedData[originalItemIndex];
                    this.processedData.splice(originalItemIndex, 1);
                    
                    const newIndexItem = this.filteredData[dragEndIndex];
                    const newOriginalIndex = this.processedData.findIndex(item => item.imageName === newIndexItem.imageName);
                    this.processedData.splice(newOriginalIndex, 0, originalItem);
                }
                
                this.displayResults(this.processedData);
                this.showSimpleConfirmation('✓ Imagen movida correctamente');
            }
        }
    }

    showSimpleConfirmation(message) {
        const existingMsg = document.querySelector('.reorder-confirmation');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        const confirmation = document.createElement('div');
        confirmation.className = 'reorder-confirmation';
        confirmation.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight: bold;
        `;
        confirmation.textContent = message;
        
        document.body.appendChild(confirmation);
        
        setTimeout(() => {
            confirmation.style.opacity = '0';
            confirmation.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (confirmation.parentNode) {
                    confirmation.parentNode.removeChild(confirmation);
                }
            }, 500);
        }, 2000);
    }

    toggleTitleEdit() {
        if (!this.isEditingTitle) {
            this.startEditingTitle();
        } else {
            this.finishEditingTitle();
        }
    }

    startEditingTitle() {
        this.isEditingTitle = true;
        const currentTitleText = this.reportTitle.textContent;
        
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'title-input';
        titleInput.value = currentTitleText;
        
        this.reportTitle.replaceWith(titleInput);
        titleInput.focus();
        titleInput.select();
        
        this.editTitleBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Guardar
        `;
        
        titleInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.finishEditingTitle();
            }
        });
        
        titleInput.addEventListener('blur', () => {
            this.finishEditingTitle();
        });
    }

    finishEditingTitle() {
        if (!this.isEditingTitle) return;
        
        const titleInput = document.querySelector('.title-input');
        if (titleInput) {
            const newTitle = titleInput.value.trim() || 'Resultados del procesamiento';
            this.currentTitle = newTitle;
            
            this.reportTitle.textContent = newTitle;
            titleInput.replaceWith(this.reportTitle);
            
            this.editTitleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Editar Título
            `;
            
            this.isEditingTitle = false;
        }
    }

    enhanceAccessibility() {
        this.exportCsvBtn.setAttribute('aria-label', 'Exportar resultados a formato CSV');
        this.exportPdfBtn.setAttribute('aria-label', 'Exportar resultados a formato PDF');
        
        document.querySelectorAll('.image-card').forEach((card, index) => {
            card.setAttribute('aria-label', `Imagen ${index + 1}`);
            card.setAttribute('aria-describedby', `comment-${index}`);
        });
        
        this.progressBar.setAttribute('role', 'progressbar');
        this.progressBar.setAttribute('aria-valuenow', '0');
        this.progressBar.setAttribute('aria-valuemin', '0');
        this.progressBar.setAttribute('aria-valuemax', '100');
        
        this.searchInput.setAttribute('aria-label', 'Buscar en comentarios');
        this.fileFilter.setAttribute('aria-label', 'Filtrar por archivo de origen');
    }

    exportToCSV(data) {
        if (data.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        
        let csvContent = "Nombre de imagen,Comentario asociado,Archivo origen,Línea\n";
        
        data.forEach(item => {
            const escapedComment = item.comment.includes(',') || item.comment.includes('"') 
                ? `"${item.comment.replace(/"/g, '""')}"` 
                : item.comment;
            
            csvContent += `${item.imageName},${escapedComment},${item.sourceFile},${item.lineNumber}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'whatsapp_images_comments.csv');
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async exportToPDF(data) {
        if (data.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }
        
        this.loadingIndicator.style.display = 'block';
        try {
            if (typeof window.jspdf === 'undefined') {
                throw new Error('jsPDF no está disponible. Asegúrate de incluir la librería jsPDF.');
            }

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            
            const startY = this.createPDFTemplate(pdf, this.currentTitle, data);
            
            const imagesPerPage = 9;
            const imagesPerRow = 3;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            
            const imageWidth = (pageWidth - (2 * margin) - ((imagesPerRow - 1) * 5)) / imagesPerRow;
            const imageHeight = 60;
            const textHeight = 20;
            const totalCardHeight = imageHeight + textHeight;
            
            let currentImageIndex = 0;
            let currentPage = 0;
            let yPosition = startY;
            
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                const row = Math.floor(currentImageIndex / imagesPerRow);
                const col = currentImageIndex % imagesPerRow;
                
                const x = margin + (col * (imageWidth + 5));
                const y = yPosition + (row * totalCardHeight);
                
                if (y + totalCardHeight > pageHeight - margin) {
                    pdf.addPage();
                    currentPage++;
                    currentImageIndex = 0;
                    yPosition = margin;
                    
                    pdf.setFontSize(10);
                    pdf.text(`Página ${currentPage + 1}`, pageWidth - 20, pageHeight - 10);
                    
                    const newRow = Math.floor(currentImageIndex / imagesPerRow);
                    const newCol = currentImageIndex % imagesPerRow;
                    const newX = margin + (newCol * (imageWidth + 5));
                    const newY = yPosition + (newRow * totalCardHeight);
                    
                    await this.addImageToPDF(pdf, item, newX, newY, imageWidth, imageHeight);
                    currentImageIndex++;
                } else {
                    await this.addImageToPDF(pdf, item, x, y, imageWidth, imageHeight);
                    currentImageIndex++;
                }
                
                if (currentImageIndex >= imagesPerPage) {
                    currentImageIndex = 0;
                    yPosition = margin;
                    if (i < data.length - 1) {
                        pdf.addPage();
                        currentPage++;
                        pdf.setFontSize(10);
                        pdf.text(`Página ${currentPage + 1}`, pageWidth - 20, pageHeight - 10);
                    }
                }
            }
            
            pdf.save('whatsapp_images_report.pdf');
            this.loadingIndicator.style.display = 'none';
        } catch (error) {
            this.loadingIndicator.style.display = 'none';
            alert('Error al generar PDF: ' + error.message);
        }
    }

    createPDFTemplate(pdf, title, data) {
        pdf.setFillColor(37, 211, 102);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), 40, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.text(title, 20, 25);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.text(`Generado: ${new Date().toLocaleString()}`, 20, 45);
        pdf.text(`Total de imágenes: ${data.length}`, 20, 55);
        
        pdf.setDrawColor(37, 211, 102);
        pdf.setLineWidth(0.5);
        pdf.line(20, 60, pdf.internal.pageSize.getWidth() - 20, 60);
        
        return 70;
    }

    async addImageToPDF(pdf, item, x, y, width, height) {
        try {
            let imageData = null;
            if (this.imageFiles.has(item.imageName)) {
                imageData = this.imageFiles.get(item.imageName);
            } else {
                const nameWithoutExt = item.imageName.replace(/\.[^/.]+$/, "");
                if (this.imageFiles.has(nameWithoutExt)) {
                    imageData = this.imageFiles.get(nameWithoutExt);
                }
            }
            
            if (imageData) {
                const base64 = await this.blobToBase64(imageData.blob);
                pdf.addImage(base64, 'JPEG', x, y, width, height);
            } else {
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(x, y, width, height, 'S');
                pdf.setFontSize(8);
                pdf.text('[Imagen no disponible]', x + 5, y + height / 2);
            }
            
            pdf.setFontSize(7);
            
            if (item.comment && item.comment !== 'Sin comentarios') {
                const commentLines = pdf.splitTextToSize(item.comment, width - 2);
                pdf.text(commentLines, x, y + height + 5);
            }
            
        } catch (error) {
            console.error('Error al agregar imagen al PDF:', error);
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(x, y, width, height, 'S');
            pdf.setFontSize(8);
            pdf.text('[Error cargando imagen]', x + 5, y + height / 2);
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function() {
                resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.whatsAppProcessor = new WhatsAppProcessorUI();
});
