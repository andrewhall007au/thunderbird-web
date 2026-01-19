'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface GPXUploadProps {
  onUpload: (file: File) => void;
  isLoading?: boolean;
}

export default function GPXUpload({ onUpload, isLoading }: GPXUploadProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/gpx+xml': ['.gpx'],
      'application/xml': ['.gpx'],
      'text/xml': ['.gpx']
    },
    maxFiles: 1,
    onDrop,
    disabled: isLoading
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive
          ? 'border-blue-400 bg-blue-400/10'
          : 'border-gray-600 hover:border-gray-500'}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      {isDragActive ? (
        <p className="text-blue-400">Drop your GPX file here...</p>
      ) : (
        <>
          <p className="text-gray-300 mb-2">
            Drag & drop a GPX file, or click to select
          </p>
          <p className="text-sm text-gray-500">
            Export from Gaia GPS, AllTrails, Caltopo, or your GPS device
          </p>
        </>
      )}
    </div>
  );
}
