class ImageZoom {
    constructor(container) {
        this.container = container;
        this.wrapper = container.querySelector('.map-wrapper');
        this.image = container.querySelector('.map');
        this.pointsContainer = container.querySelector('.points-container');
        this.measurementLine = container.querySelector('.measurement-line');
        
        this.scale = 0.4;
        this.position = { x: 0, y: 0 };
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.isDraggingPoint = false;
        
        // Точки измерений
        this.greenPoint = null;
        this.redPoint = null;
        this.isMeasurementMode = false;
        this.points = [];
        this.preventNextClick = false;
        this.wasDragging = false;
        
        this.init();
    }

    init() {
        if (this.image.complete) {
            this.onImageLoad();
        } else {
            this.image.addEventListener('load', this.onImageLoad.bind(this));
        }
    }
    
    bindEvents() {
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        this.container.addEventListener('mousedown', this.startDrag.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.endDrag.bind(this));
        
        this.container.addEventListener('dragstart', (e) => e.preventDefault());
        this.image.addEventListener('dragstart', (e) => e.preventDefault());
        
        document.querySelectorAll('.zoom-controls-top .zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleButtonClick(e));
        });
        
        document.getElementById('clear-points').addEventListener('click', this.clearPoints.bind(this));
        document.getElementById('toggle-measure').addEventListener('click', this.toggleMeasurementMode.bind(this));
        
        this.container.addEventListener('click', this.handleImageClick.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    // Обработчик клика по изображению для установки точек
    handleImageClick(e) {
        if (this.isDraggingPoint || this.preventNextClick || !this.isMeasurementMode || e.target.closest('.zoom-btn')|| this.wasDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // Получаем координаты относительно контейнера
        const rect = this.container.getBoundingClientRect();
        const containerX = e.clientX - rect.left;
        const containerY = e.clientY - rect.top;
        
        // Преобразуем в координаты исходного изображения
        const imageX = (containerX - this.position.x) / this.scale;
        const imageY = (containerY - this.position.y) / this.scale;
        
        // Проверяем границы изображения
        if (imageX >= 0 && imageX <= this.imageWidth && imageY >= 0 && imageY <= this.imageHeight) {
            this.addPoint(imageX, imageY);
        }
    }

    // Добавление точки
    addPoint(x, y) {
        if (this.points.length >= 2) {
            this.clearPoints();
        }
        
        const pointType = this.points.length === 0 ? 'green' : 'red';
        const point = {
            x: x, // Координаты в пикселях исходного изображения
            y: y, // Координаты в пикселях исходного изображения
            type: pointType,
            element: this.createPointElement(x, y, pointType)
        };
        
        this.points.push(point);
        
        if (pointType === 'green') {
            this.greenPoint = point;
        } else {
            this.redPoint = point;
            this.calculateMeasurements();
        }
        
        this.updateUI();
    }
    
    // Создание элемента точки
    createPointElement(x, y, type) {
        const point = document.createElement('div');
        point.className = `point ${type}`;
        
        const label = document.createElement('div');
        label.className = 'point-label';
        label.textContent = type === 'green' ? 'Точка A' : 'Точка B';
        point.appendChild(label);
        
        this.pointsContainer.appendChild(point);
        
        // Обновляем позицию точки
        this.updatePointPosition(point, x, y);
        
        point.addEventListener('mousedown', (e) => this.startPointDrag(e, point));
        
        return point;
    }

    startPointDrag(e, pointElement) {
        if (!this.isMeasurementMode) return;
        
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingPoint = true;
        this.preventNextClick = true;
        
        const pointIndex = this.points.findIndex(p => p.element === pointElement);
        if (pointIndex === -1) return;
        
        const point = this.points[pointIndex];
        const startX = e.clientX;
        const startY = e.clientY;
        
        const startImageX = point.x;
        const startImageY = point.y;
        
        const onMouseMove = (moveEvent) => {
            const rect = this.container.getBoundingClientRect();
            const deltaX = (moveEvent.clientX - startX) / this.scale;
            const deltaY = (moveEvent.clientY - startY) / this.scale;
            
            // Обновляем координаты в пикселях исходного изображения
            point.x = startImageX + deltaX;
            point.y = startImageY + deltaY;
            
            // Ограничиваем в пределах изображения
            point.x = Math.max(0, Math.min(this.imageWidth, point.x));
            point.y = Math.max(0, Math.min(this.imageHeight, point.y));
            
            // Обновляем позицию на экране
            this.updatePointPosition(point.element, point.x, point.y);
            
            if (this.points.length === 2) {
                this.calculateMeasurements();
            }
        };
        
        const onMouseUp = () => {
        this.isDraggingPoint = false;
        
        // setTimeout для блока click события
        setTimeout(() => {
            this.preventNextClick = false;
        }, 50);
        
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }
    
    // Вычисление измерений
    calculateMeasurements() {
        if (this.points.length !== 2) return;
        
        const [pointA, pointB] = this.points;
        
        // Расстояние в пикселях исходного изображения
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Азимут
        let azimuth = (Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360;
        if (azimuth < 0) azimuth += 360;
        let azimuthX5 = azimuth * 5;
        
        this.updateMeasurementLine(pointA, pointB, distance);
        
        document.getElementById('distance-value').textContent = `${distance.toFixed(1)} м`;
        document.getElementById('azimuth-value').textContent = `${azimuth.toFixed(1)}° = ${azimuthX5.toFixed(1)}`;
    }
    
    // Обновление линии измерения
    updateMeasurementLine(pointA, pointB, distance) {
        // Рассчитываем экранные координаты для линии
        const screenX1 = pointA.x * this.scale + this.position.x;
        const screenY1 = pointA.y * this.scale + this.position.y;
        const screenX2 = pointB.x * this.scale + this.position.y;
        
        const angle = Math.atan2(
            (pointB.y * this.scale + this.position.y) - screenY1,
            (pointB.x * this.scale + this.position.x) - screenX1
        );
        
        // Длина линии в экранных координатах
        const screenDistance = distance * this.scale;
        
        this.measurementLine.style.display = 'block';
        this.measurementLine.style.left = `${screenX1}px`;
        this.measurementLine.style.top = `${screenY1}px`;
        this.measurementLine.style.width = `${screenDistance}px`;
        this.measurementLine.style.transform = `rotate(${angle}rad)`;
    }

    updateAllPoints() {
        this.points.forEach(point => {
            this.updatePointPosition(point.element, point.x, point.y);
        });
        
        if (this.points.length === 2) {
            this.calculateMeasurements();
        }
    }
    
    // Очистка точек
    clearPoints() {
        this.points.forEach(point => {
            if (point.element && point.element.parentNode) {
                point.element.parentNode.removeChild(point.element);
            }
        });
        
        this.points = [];
        this.greenPoint = null;
        this.redPoint = null;
        this.measurementLine.style.display = 'none';
        
        document.getElementById('distance-value').textContent = '0 м';
        document.getElementById('azimuth-value').textContent = '0°';
        this.updateUI();
    }
    
    // Переключение режима измерений
    toggleMeasurementMode() {
        this.isMeasurementMode = !this.isMeasurementMode;
        this.updateUI();
    }
    
    handleWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        this.zoom(delta, e.clientX, e.clientY);
    }
    handleResize() {
        // Обновляем размеры контейнера
        this.containerWidth = this.container.offsetWidth;
        this.containerHeight = this.container.offsetHeight;
        this.updateTransform();
    }
    
    zoom(delta, clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        const containerX = clientX - rect.left;
        const containerY = clientY - rect.top;
        
        const imageX = (containerX - this.position.x) / this.scale;
        const imageY = (containerY - this.position.y) / this.scale;
        
        const oldScale = this.scale;
        this.scale = Math.max(0.1, Math.min(5, this.scale + delta));
        
        this.position.x = containerX - imageX * this.scale;
        this.position.y = containerY - imageY * this.scale;
        
        this.updateTransform();
        this.updateAllPoints(); // Обновляем все точки
        this.updateUI();
    }
    updatePointsScale() {
        this.points.forEach(point => {
            this.updatePointPosition(point);
            
            // Также обновляем масштаб label
            const label = point.element.querySelector('.point-label');
            if (label) {
                label.style.transform = `scale(${this.scale})`;
            }
        });
        
        // Обновляем линию измерения если точки есть
        if (this.points.length === 2) {
            this.calculateMeasurements();
        }
    }
    
    startDrag(e) {
        if (this.isDraggingPoint || e.button !== 0) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.startX = e.clientX - this.position.x;
        this.startY = e.clientY - this.position.y;
        this.container.style.cursor = 'grabbing';
    }
    
    drag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        this.position.x = e.clientX - this.startX;
        this.position.y = e.clientY - this.startY;
        this.wasDragging = true;
        
        this.updateTransform();
        this.updateAllPoints(); // Обновляем точки при перемещении карты
        setTimeout(() => {
            this.wasDragging = false;
        }, 500);
    }
    
    endDrag(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.container.style.cursor = 'grab';
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this.startDrag(e.touches[0]);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            this.handlePinchStart(e);
        }
    }
    
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this.drag(e.touches[0]);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            this.handlePinchMove(e);
        }
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        this.endDrag();
        this.pinchStart = null;
    }
    
    handlePinchStart(e) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        this.pinchStart = {
            distance: Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            ),
            centerX: (touch1.clientX + touch2.clientX) / 2,
            centerY: (touch1.clientY + touch2.clientY) / 2,
            scale: this.scale,
            position: { ...this.position }
        };
    }
    
    handlePinchMove(e) {
        if (!this.pinchStart) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        // Вычисляем изменение масштаба
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        const scaleChange = currentDistance / this.pinchStart.distance;
        this.scale = Math.max(0.1, Math.min(5, this.pinchStart.scale * scaleChange));
        
        // Вычисляем центр pinch жеста
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        const rect = this.container.getBoundingClientRect();
        const containerX = centerX - rect.left;
        const containerY = centerY - rect.top;
        
        // Вычисляем смещение для сохранения центра жеста
        const scaleRatio = this.scale / this.pinchStart.scale;
        this.position.x = containerX - (containerX - this.pinchStart.position.x) * scaleRatio;
        this.position.y = containerY - (containerY - this.pinchStart.position.y) * scaleRatio;
        
        this.updateTransform();
        this.updateUI();
    }
    
    handleButtonClick(e) {
        if (!e.target.matches('.zoom-btn')) return;
        
        const action = e.target.dataset.action;
        const rect = this.container.getBoundingClientRect();
        
        switch(action) {
            case 'zoom-in':
                this.zoom(0.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
                break;
            case 'zoom-out':
                this.zoom(-0.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
                break;
            case 'reset':
                this.reset();
                break;
        }
    }
    onImageLoad() {
        this.imageWidth = this.image.naturalWidth;
        this.imageHeight = this.image.naturalHeight;
        
        this.wrapper.style.width = `${this.imageWidth}px`;
        this.wrapper.style.height = `${this.imageHeight}px`;
        
        this.containerWidth = this.container.offsetWidth;
        this.containerHeight = this.container.offsetHeight;
        
        this.centerImage();
        this.bindEvents();
        this.updateUI();
    }

    centerImage() {
        this.position.x = (this.containerWidth - this.imageWidth * this.scale) / 2;
        this.position.y = (this.containerHeight - this.imageHeight * this.scale) / 2;
        this.updateTransform();
    }
    
    reset() {
        this.scale = 1;
        this.centerImage();
        this.updateAllPoints(); // Обновляем точки
        this.updateUI();
    }
    
    updateTransform() {
        this.wrapper.style.transform = `translate(${this.position.x}px, ${this.position.y}px) scale(${this.scale})`;
    }
    
    updateUI() {
        // Обновление состояния кнопки режима измерений
        const measureButton = document.getElementById('toggle-measure');
        if (this.isMeasurementMode) {
            measureButton.classList.add('active');
            measureButton.textContent = 'Выключить измерения';
            this.container.style.cursor = 'crosshair';
        } else {
            measureButton.classList.remove('active');
            measureButton.textContent = 'Режим измерений';
            this.container.style.cursor = this.isDragging ? 'grabbing' : 'grab';
        }

        // Обновление состояния кнопки очистки точек
        const clearButton = document.getElementById('clear-points');
        if (clearButton) {
            clearButton.disabled = this.points.length === 0;
            clearButton.style.opacity = this.points.length === 0 ? '0.6' : '1';
        }

        // Обновление подсказок для пользователя
        this.updateInstructions();

        // Обновление позиций точек при изменении масштаба или перемещении
        this.updatePointPosition();

        // Обновление линии измерения если точки есть
        if (this.points.length === 2) {
            this.calculateMeasurements();
        }
    }

    updateInstructions() {
        // Удаляем старые инструкции если есть
        const oldInstructions = this.container.querySelector('.measure-instructions');
        if (oldInstructions) {
            oldInstructions.remove();
        }

        // Добавляем новые инструкции если режим измерений активен
        if (this.isMeasurementMode) {
            const instructions = document.createElement('div');
            instructions.className = 'measure-instructions';
            instructions.innerHTML = `
                <div style="position: absolute; top: 10px; left: 10px; background: rgba(255,255,255,0.9); 
                        padding: 10px; border-radius: 5px; font-size: 12px; z-index: 20; color: black;">
                    <strong>Инструкция:</strong><br>
                    <h2>• Выключите режим измерений при перемещении карты!!!</h2><br>
                    • Кликните чтобы поставить ${this.points.length === 0 ? 'зелёную' : this.points.length === 1 ? 'красную' : 'новую (очистить текущие)'} точку<br>
                    • Перетаскивайте точки для точного позиционирования<br>
                    • ${this.points.length < 2 ? 'Поставьте обе точки для измерений' : 'Измерения активны'}
                </div>
            `;
            this.container.appendChild(instructions);
        }
    }

    updatePointPosition(pointElement, imageX, imageY) {
        // Преобразуем координаты исходного изображения в экранные координаты
        const screenX = imageX * this.scale + this.position.x;
        const screenY = imageY * this.scale + this.position.y;
        
        pointElement.style.left = `${screenX}px`;
        pointElement.style.top = `${screenY}px`;
        pointElement.style.transform = 'translate(-50%, -50%)';
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.map-conteiner');
    new ImageZoom(container);
});