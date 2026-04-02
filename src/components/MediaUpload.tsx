import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { mediaService } from '../services/mediaService';

interface MediaUploadProps {
  onComplete?: () => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string;
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onComplete }) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFiles = useCallback(async (files: File[]) => {
    const newFiles = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: 'uploading' as const,
      preview: file.type.startsWith('image') ? URL.createObjectURL(file) : undefined
    }));

    setUploadingFiles(prev => [...prev, ...newFiles]);

    // Process each file
    for (const uploadItem of newFiles) {
      try {
        // Convert file to base64 for storage (demo purposes)
        const base64Data = await fileToBase64(uploadItem.file);
        
        // Upload metadata to Firestore
        await mediaService.uploadMedia(uploadItem.file, base64Data);

        setUploadingFiles(prev => 
          prev.map(f => f.id === uploadItem.id ? { ...f, status: 'completed', progress: 100 } : f)
        );
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadingFiles(prev => 
          prev.map(f => f.id === uploadItem.id ? { ...f, status: 'error', error: 'Upload failed' } : f)
        );
      }
    }
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        handleFiles(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleFiles(acceptedFiles);
  }, [handleFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.ogg']
    },
    maxSize: 5 * 1024 * 1024 // 5MB limit for demo
  });

  const removeFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const allCompleted = uploadingFiles.length > 0 && uploadingFiles.every(f => f.status === 'completed');

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
          isDragActive 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-stone-200 hover:border-indigo-300 hover:bg-stone-50/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-2xl transition-all ${isDragActive ? 'bg-indigo-500 text-white scale-110' : 'bg-indigo-50 text-indigo-600'}`}>
            <Upload size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-stone-900">
              {isDragActive ? 'Drop files here' : 'Click or drag files to upload'}
            </p>
            <p className="text-sm text-stone-500">
              Supports images and videos (up to 5MB)
            </p>
          </div>
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {uploadingFiles.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-black/5 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0 relative">
                  {item.preview ? (
                    <img src={item.preview} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : item.file.type.startsWith('video') ? (
                    <div className="w-full h-full flex items-center justify-center bg-stone-800 text-white">
                      <VideoIcon size={20} />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-200 text-stone-400">
                      <File size={20} />
                    </div>
                  )}
                  {item.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Loader2 size={16} className="text-white animate-spin" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-medium text-stone-900 truncate pr-4">{item.file.name}</p>
                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">
                      {(item.file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        className={`h-full transition-all ${
                          item.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'
                        }`}
                      />
                    </div>
                    {item.status === 'completed' && <CheckCircle2 size={16} className="text-green-500" />}
                    {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                  </div>
                </div>

                <button
                  onClick={() => removeFile(item.id)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {allCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center pt-4"
        >
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 font-bold"
          >
            Done
          </button>
        </motion.div>
      )}
    </div>
  );
};
