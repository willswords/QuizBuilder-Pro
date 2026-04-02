import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Trash2, 
  Plus, 
  X, 
  FileText,
  Search,
  Grid,
  List as ListIcon,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { mediaService } from '../services/mediaService';
import { MediaItem } from '../types';
import { MediaUpload } from './MediaUpload';

interface MediaLibraryProps {
  onSelect?: (media: MediaItem) => void;
  onClose?: () => void;
  selectedId?: string;
  allowSelection?: boolean;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({ 
  onSelect, 
  onClose, 
  selectedId,
  allowSelection = true
}) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pastingCount, setPastingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = mediaService.subscribeToMedia((items) => {
      setMediaItems(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setPastingCount(prev => prev + 1);
            try {
              const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
              });
              
              await mediaService.uploadMedia(file, base64Data);
            } catch (error) {
              console.error('Paste upload failed:', error);
            } finally {
              setPastingCount(prev => Math.max(0, prev - 1));
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const isPasting = pastingCount > 0;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await mediaService.deleteMedia(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const filteredItems = mediaItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || item.type.startsWith(filterType);
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-black/5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-black/5 bg-stone-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <ImageIcon size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Media Library</h2>
            <div className="flex items-center gap-2">
              <p className="text-xs text-stone-500">{mediaItems.length} items stored</p>
              {isPasting && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  <Loader2 size={10} className="animate-spin" />
                  Pasting...
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 hover:bg-black/5 rounded-lg text-stone-600 transition-colors"
            title={viewMode === 'grid' ? 'Switch to List' : 'Switch to Grid'}
          >
            {viewMode === 'grid' ? <ListIcon size={20} /> : <Grid size={20} />}
          </button>
          <button
            onClick={() => setIsUploading(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm font-medium text-sm"
          >
            <Plus size={18} />
            Upload
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/5 rounded-lg text-stone-400 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b border-black/5 flex flex-wrap gap-4 items-center justify-between bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search media..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <div className="flex bg-stone-100 p-1 rounded-xl">
          {(['all', 'image', 'video'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterType === type 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}s
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-stone-50/50">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-4 py-12">
            <div className="p-6 bg-stone-100 rounded-full">
              <ImageIcon size={48} className="opacity-20" />
            </div>
            <div className="text-center">
              <p className="font-medium text-stone-600">No media items found</p>
              <p className="text-sm">Upload some files to get started</p>
            </div>
            <button
              onClick={() => setIsUploading(true)}
              className="mt-2 text-indigo-600 font-medium hover:underline text-sm"
            >
              Upload your first file
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => allowSelection && onSelect?.(item)}
                  className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedId === item.id 
                      ? 'border-indigo-500 ring-4 ring-indigo-50' 
                      : 'border-transparent hover:border-indigo-200 bg-white shadow-sm'
                  }`}
                >
                  {item.type.startsWith('image') ? (
                    <img 
                      src={item.url} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800 text-white">
                      <VideoIcon size={32} className="mb-2 opacity-50" />
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">Video</span>
                    </div>
                  )}

                  {/* Selection Overlay */}
                  {selectedId === item.id && (
                    <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center">
                      <div className="bg-white rounded-full p-1 shadow-lg">
                        <CheckCircle2 size={24} className="text-indigo-600" />
                      </div>
                    </div>
                  )}

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="bg-black/60 backdrop-blur-sm rounded-lg p-1.5">
                      <p className="text-[10px] text-white font-medium truncate leading-tight">
                        {item.name}
                      </p>
                      <p className="text-[8px] text-white/60 uppercase tracking-tighter">
                        {(item.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => allowSelection && onSelect?.(item)}
                  className={`flex items-center gap-4 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedId === item.id 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-transparent hover:bg-white hover:shadow-sm bg-stone-100/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                    {item.type.startsWith('image') ? (
                      <img src={item.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-800 text-white">
                        <VideoIcon size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                    <p className="text-xs text-stone-500">
                      {item.type} • {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedId === item.id && <CheckCircle2 size={20} className="text-indigo-600" />}
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Upload Modal Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-stone-900">Upload Media</h3>
              <button
                onClick={() => setIsUploading(false)}
                className="p-2 hover:bg-black/5 rounded-full text-stone-400"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1">
              <MediaUpload onComplete={() => setIsUploading(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-bold text-stone-900 mb-2">Delete Media?</h3>
              <p className="text-sm text-stone-500 mb-6">
                Are you sure you want to delete this media item? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors shadow-lg shadow-red-100"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
