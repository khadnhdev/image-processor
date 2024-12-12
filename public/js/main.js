// Khai báo biến toàn cục
let currentAction = null;
let actionModal = null;
let dropZone, previewSection, cropArea;
let currentFile = null;

document.addEventListener('DOMContentLoaded', function() {
    // Khởi tạo modal khi DOM đã load
    actionModal = new bootstrap.Modal(document.getElementById('actionModal'));
    
    // Hàm xử lý lựa chọn action
    window.selectAction = function(action) {
        currentAction = action;
        actionModal.hide();
        
        dropZone.classList.add('d-none');
        previewSection.classList.remove('d-none');
        
        if (action === 'crop') {
            const scaleX = imagePreview.offsetWidth / originalWidth;
            const scaleY = imagePreview.offsetHeight / originalHeight;
            
            const width = Math.round(parseInt(newWidth.value) * scaleX);
            const height = Math.round(parseInt(newHeight.value) * scaleY);
            
            const left = Math.round((imagePreview.offsetWidth - width) / 2);
            const top = Math.round((imagePreview.offsetHeight - height) / 2);
            
            cropArea.style.width = width + 'px';
            cropArea.style.height = height + 'px';
            cropArea.style.left = left + 'px';
            cropArea.style.top = top + 'px';
            
            if (keepAspectRatio.checked) {
                aspectRatio = width / height;
            }
            cropArea.classList.add('active');
            resizeHandles.classList.remove('active');
            document.querySelector('#resizeBtn').textContent = 'Drop hình ảnh';
        } else {
            cropArea.classList.remove('active');
            resizeHandles.classList.add('active');
            document.querySelector('#resizeBtn').textContent = 'Thay đổi kích thước';
        }
    };
    
    // Reset trạng thái ban đầu
    function resetState() {
        currentFile = null;
        aspectRatio = 1;
        originalWidth = 0;
        originalHeight = 0;
        
        // Ẩn phần preview và hiện khung drop
        previewSection.classList.add('d-none');
        dropZone.classList.remove('d-none');
        
        // Reset các input
        newWidth.value = '';
        newHeight.value = '';
        originalSize.textContent = '';
        
        // Ẩn crop area
        cropArea.classList.remove('active');
        
        // Xóa ảnh preview
        imagePreview.src = '';
    }
    
    dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    previewSection = document.getElementById('previewSection');
    const imagePreview = document.getElementById('imagePreview');
    const originalSize = document.getElementById('originalSize');
    const newWidth = document.getElementById('newWidth');
    const newHeight = document.getElementById('newHeight');
    const keepAspectRatio = document.getElementById('keepAspectRatio');
    const resizeBtn = document.getElementById('resizeBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    let aspectRatio = 1;
    let originalWidth = 0;
    let originalHeight = 0;
    
    // Thêm biến cho crop area
    cropArea = document.getElementById('cropArea');
    let isResizing = false;
    let isDragging = false;
    let startX, startY, startWidth, startHeight;
    let startLeft, startTop;
    let activeHandle = null;

    const resizeHandles = document.getElementById('resizeHandles');
    let isResizingImage = false;
    let startImageWidth, startImageHeight;

    // Xử lý Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        if (files.length > 1) {
            alert('Vui lòng tải lên từng ảnh một.');
            return;
        }

        const file = files[0];
        if (!file.type.match('image.*')) {
            alert('Vui lòng chọn file ảnh (jpg, jpeg, png)');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            currentFile = data.filename;
            imagePreview.src = `/uploads/${data.filename}`;
            originalSize.textContent = `Kích thước gốc: ${data.originalWidth}x${data.originalHeight}px`;
            originalWidth = data.originalWidth;
            originalHeight = data.originalHeight;
            
            // Hiển thị modal để chọn action
            actionModal.show();
            
            newWidth.value = data.originalWidth;
            newHeight.value = data.originalHeight;
            aspectRatio = data.originalWidth / data.originalHeight;
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Có lỗi xảy ra khi tải ảnh lên');
        });
    }

    // Xử lý giữ tỷ lệ ảnh
    newWidth.addEventListener('input', () => {
        if (keepAspectRatio.checked) {
            newHeight.value = Math.round(newWidth.value / aspectRatio);
        }
    });

    newHeight.addEventListener('input', () => {
        if (keepAspectRatio.checked) {
            newWidth.value = Math.round(newHeight.value * aspectRatio);
        }
    });

    // Xử lý resize ảnh
    resizeBtn.addEventListener('click', () => {
        if (!currentFile) {
            dropZone.classList.remove('d-none');
            previewSection.classList.add('d-none');
            resetState();
            return;
        }
        
        if (currentAction === 'resize') {
            // Cập nhật kích thước ảnh preview trước khi gửi request
            const newWidthValue = parseInt(newWidth.value);
            const newHeightValue = parseInt(newHeight.value);
            
            // Tính toán tỷ lệ scale
            const scaleX = newWidthValue / originalWidth;
            const scaleY = newHeightValue / originalHeight;
            
            // Cập nhật kích thước ảnh preview
            const previewWidth = imagePreview.naturalWidth * scaleX;
            const previewHeight = imagePreview.naturalHeight * scaleY;
            
            imagePreview.style.width = `${previewWidth}px`;
            imagePreview.style.height = `${previewHeight}px`;
            
            // Chỉ resize không crop
            fetch('/resize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: currentFile,
                    width: newWidthValue,
                    height: newHeightValue
                })
            })
            .then(response => response.json())
            .then(handleResizeResponse)
            .catch(handleError);
        } else {
            // Tính toán tỷ lệ crop
            const cropX = cropArea.offsetLeft / imagePreview.offsetWidth;
            const cropY = cropArea.offsetTop / imagePreview.offsetHeight;
            const cropWidth = cropArea.offsetWidth / imagePreview.offsetWidth;
            const cropHeight = cropArea.offsetHeight / imagePreview.offsetHeight;

            fetch('/resize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: currentFile,
                    width: newWidth.value,
                    height: newHeight.value,
                    crop: {
                        x: Math.round(cropX * originalWidth),
                        y: Math.round(cropY * originalHeight),
                        width: Math.round(cropWidth * originalWidth),
                        height: Math.round(cropHeight * originalHeight)
                    }
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Tạo link tải xuống
                    const downloadLink = document.createElement('a');
                    downloadLink.href = `/uploads/${data.resizedImage}?t=${Date.now()}`;
                    downloadLink.download = `resized-${currentFile}`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    // Cập nhật preview
                    imagePreview.src = downloadLink.href;
                    // Ẩn crop area sau khi cắt xong
                    cropArea.classList.remove('active');
                    currentFile = null; // Reset trạng thái để có thể drop ảnh mới
                    
                    imagePreview.addEventListener('load', () => {
                        const imageWidth = imagePreview.offsetWidth;
                        const imageHeight = imagePreview.offsetHeight;
                        
                        const newLeft = Math.round(cropX * imageWidth);
                        const newTop = Math.round(cropY * imageHeight);
                        const newWidth = Math.round(cropWidth * imageWidth);
                        const newHeight = Math.round(cropHeight * imageHeight);
                        
                        cropArea.style.left = Math.min(newLeft, imageWidth - newWidth) + 'px';
                        cropArea.style.top = Math.min(newTop, imageHeight - newHeight) + 'px';
                        cropArea.style.width = Math.min(newWidth, imageWidth) + 'px';
                        cropArea.style.height = Math.min(newHeight, imageHeight) + 'px';
                    }, { once: true });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Có lỗi xảy ra khi thay đổi kích thước ảnh');
            });
        }
    });

    // Xử lý tải xuống ZIP
    downloadBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        const zip = new JSZip();
        const response = await fetch(imagePreview.src);
        const blob = await response.blob();
        
        zip.file('resized-image' + getFileExtension(currentFile), blob);

        zip.generateAsync({type: 'blob'})
            .then(content => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = 'resized-images.zip';
                link.click();
            });
    });

    function getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 1);
    }

    // Xử lý crop area
    cropArea.addEventListener('mousedown', initCrop);

    function initCrop(e) {
        // Kiểm tra xem click có phải vào handle hay không
        const isHandle = e.target.classList.contains('handle');
        // Kiểm tra xem click có phải vào vùng crop border hay không
        const isCropBorder = e.target.classList.contains('crop-border');
        
        if (isHandle) {
            isResizing = true;
            activeHandle = e.target;
        } else if (isCropBorder || e.target === cropArea) {
            isDragging = true;
        }

        startX = e.clientX;
        startY = e.clientY;
        startWidth = cropArea.offsetWidth;
        startHeight = cropArea.offsetHeight;
        startLeft = cropArea.offsetLeft;
        startTop = cropArea.offsetTop;

        document.addEventListener('mousemove', handleCrop);
        document.addEventListener('mouseup', stopCrop);
    }

    function handleCrop(e) {
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const imageWidth = imagePreview.offsetWidth;
        const imageHeight = imagePreview.offsetHeight;

        if (isDragging) {
            // Di chuyển vùng crop
            const newLeft = startLeft + dx;
            const newTop = startTop + dy;
            
            // Giới hạn trong phạm vi ảnh
            const maxLeft = imageWidth - cropArea.offsetWidth;
            const maxTop = imageHeight - cropArea.offsetHeight;
            
            // Đảm bảo khung không vượt ra ngoài ảnh
            const boundedLeft = Math.max(0, Math.min(newLeft, maxLeft));
            const boundedTop = Math.max(0, Math.min(newTop, maxTop));
            
            cropArea.style.left = boundedLeft + 'px';
            cropArea.style.top = boundedTop + 'px';
            updateCropDimensions();
        } else if (isResizing) {
            const minSize = 50;
            let newWidth, newHeight;

            // Nếu đang giữ tỷ lệ, tính toán kích thước dựa trên tỷ lệ
            const calculateDimensions = (width, height) => {
                if (keepAspectRatio.checked) {
                    const ratio = startWidth / startHeight;
                    if (Math.abs(dx) > Math.abs(dy)) {
                        width = Math.min(Math.max(minSize, width), imageWidth - cropArea.offsetLeft);
                        height = width / ratio;
                    } else {
                        height = Math.min(Math.max(minSize, height), imageHeight - cropArea.offsetTop);
                        width = height * ratio;
                    }
                }
                // Đảm bảo kích thước không vượt quá giới hạn ảnh
                width = Math.min(width, imageWidth - cropArea.offsetLeft);
                height = Math.min(height, imageHeight - cropArea.offsetTop);
                return { width, height };
            };

            if (activeHandle.classList.contains('bottom-right')) {
                // Góc trái trên cố định
                const dims = calculateDimensions(startWidth + dx, startHeight + dy);
                newWidth = dims.width;
                newHeight = dims.height;
            } else if (activeHandle.classList.contains('bottom-left')) {
                // Góc phải trên cố định
                const right = startLeft + startWidth;
                const dims = calculateDimensions(startWidth - dx, startHeight + dy);
                newWidth = dims.width;
                newHeight = dims.height;
                const newLeft = Math.min(Math.max(0, right - newWidth), right - minSize);
                cropArea.style.left = newLeft + 'px';
                // Điều chỉnh lại width nếu left thay đổi
                if (newLeft === 0) {
                    newWidth = right;
                }
            } else if (activeHandle.classList.contains('top-right')) {
                // Góc trái dưới cố định
                const bottom = startTop + startHeight;
                const dims = calculateDimensions(startWidth + dx, startHeight - dy);
                newWidth = dims.width;
                newHeight = dims.height;
                const newTop = Math.min(Math.max(0, bottom - newHeight), bottom - minSize);
                cropArea.style.top = newTop + 'px';
                // Điều chỉnh lại height nếu top thay đổi
                if (newTop === 0) {
                    newHeight = bottom;
                }
            } else if (activeHandle.classList.contains('top-left')) {
                // Góc phải dưới cố định
                const right = startLeft + startWidth;
                const bottom = startTop + startHeight;
                const dims = calculateDimensions(startWidth - dx, startHeight - dy);
                newWidth = dims.width;
                newHeight = dims.height;
                const newLeft = Math.min(Math.max(0, right - newWidth), right - minSize);
                const newTop = Math.min(Math.max(0, bottom - newHeight), bottom - minSize);
                cropArea.style.left = newLeft + 'px';
                cropArea.style.top = newTop + 'px';
                // Điều chỉnh lại kích thước nếu cần
                if (newLeft === 0) newWidth = right;
                if (newTop === 0) newHeight = bottom;
            }

            // Cập nhật kích thước
            cropArea.style.width = newWidth + 'px';
            cropArea.style.height = newHeight + 'px';
            updateCropDimensions();
        }
    }

    function stopCrop() {
        isResizing = false;
        isDragging = false;
        activeHandle = null;
        document.removeEventListener('mousemove', handleCrop);
        document.removeEventListener('mouseup', stopCrop);
    }

    // Thêm hàm cập nhật kích thước
    function updateCropDimensions() {
        // Tính toán kích thước thực tế dựa trên tỷ lệ với ảnh gốc
        const scaleX = originalWidth / imagePreview.offsetWidth;
        const scaleY = originalHeight / imagePreview.offsetHeight;
        
        const realWidth = Math.round(cropArea.offsetWidth * scaleX);
        const realHeight = Math.round(cropArea.offsetHeight * scaleY);
        
        // Cập nhật giá trị input
        newWidth.value = realWidth;
        newHeight.value = realHeight;
        
        // Nếu đang giữ tỷ lệ, cập nhật aspectRatio
        if (keepAspectRatio.checked) {
            aspectRatio = cropArea.offsetWidth / cropArea.offsetHeight;
        }
    }

    // Hàm xử lý phản hồi khi resize thành công
    function handleResizeResponse(data) {
        if (data.success) {
            // Tạo link tải xuống
            const downloadLink = document.createElement('a');
            downloadLink.href = `/uploads/${data.resizedImage}?t=${Date.now()}`;
            downloadLink.download = `resized-${currentFile}`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Cập nhật preview
            imagePreview.src = downloadLink.href;
            
            // Reset trạng thái
            cropArea.classList.remove('active');
            currentFile = null;
        }
    }

    // Hàm xử lý lỗi
    function handleError(error) {
        console.error('Error:', error);
        alert('Có lỗi xảy ra khi thay đổi kích thước ảnh');
    }

    // Thêm xử lý resize cho ảnh
    resizeHandles.querySelector('.handle').addEventListener('mousedown', (e) => {
        if (currentAction !== 'resize') return;
        
        isResizingImage = true;
        startX = e.clientX;
        startY = e.clientY;
        startImageWidth = imagePreview.offsetWidth;
        startImageHeight = imagePreview.offsetHeight;
        
        document.addEventListener('mousemove', handleImageResize);
        document.addEventListener('mouseup', stopImageResize);
    });

    function handleImageResize(e) {
        if (!isResizingImage) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newImageWidth = startImageWidth + dx;
        let newImageHeight = startImageHeight + dy;
        
        // Giới hạn kích thước tối thiểu
        newImageWidth = Math.max(50, newImageWidth);
        newImageHeight = Math.max(50, newImageHeight);
        
        if (keepAspectRatio.checked) {
            const ratio = originalWidth / originalHeight;
            if (Math.abs(dx) > Math.abs(dy)) {
                newImageHeight = newImageWidth / ratio;
            } else {
                newImageWidth = newImageHeight * ratio;
            }
        }
        
        imagePreview.style.width = newImageWidth + 'px';
        imagePreview.style.height = newImageHeight + 'px';
        
        // Tính toán tỷ lệ scale mới
        const scaleX = newImageWidth / startImageWidth;
        const scaleY = newImageHeight / startImageHeight;
        
        // Cập nhật giá trị input width và height
        const calculatedWidth = Math.round(originalWidth * scaleX);
        const calculatedHeight = Math.round(originalHeight * scaleY);
        
        // Cập nhật giá trị input
        newWidth.value = calculatedWidth;
        newHeight.value = calculatedHeight;
        
        // Cập nhật kích thước hiển thị
        originalSize.textContent = `Kích thước mới: ${calculatedWidth}x${calculatedHeight}px`;
    }

    function stopImageResize() {
        isResizingImage = false;
        document.removeEventListener('mousemove', handleImageResize);
        document.removeEventListener('mouseup', stopImageResize);
    }

    // Thêm xử lý cho input width/height
    newWidth.addEventListener('input', () => {
        if (!currentAction === 'resize') return;
        
        const newWidthValue = parseInt(newWidth.value);
        if (keepAspectRatio.checked) {
            const newHeightValue = Math.round(newWidthValue / aspectRatio);
            newHeight.value = newHeightValue;
        }
    });
    
    newHeight.addEventListener('input', () => {
        if (!currentAction === 'resize') return;
        
        const newHeightValue = parseInt(newHeight.value);
        if (keepAspectRatio.checked) {
            const newWidthValue = Math.round(newHeightValue * aspectRatio);
            newWidth.value = newWidthValue;
        }
    });
}); 