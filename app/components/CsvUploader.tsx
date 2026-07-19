'use client';

import React, { useState, useRef } from 'react';
import { SafetyDataPoint, parseSafetyCsv } from '../utils/csvParser';

interface CsvUploaderProps {
  onDataLoaded: (data: SafetyDataPoint[], fileName: string) => void;
  onResetDefault: () => void;
  currentFileName: string;
  dataPointsCount: number;
  dataPoints: SafetyDataPoint[];
}

export default function CsvUploader({
  onDataLoaded,
  onResetDefault,
  currentFileName,
  dataPointsCount,
  dataPoints,
}: CsvUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMsg('Please upload a valid .csv file format.');
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseSafetyCsv(text);

        if (parsed.length === 0) {
          setErrorMsg('No valid data points found in CSV. Ensure latitude & longitude columns exist.');
          return;
        }

        onDataLoaded(parsed, file.name);
      } catch (err) {
        console.error('Error reading CSV file:', err);
        setErrorMsg('Failed to parse CSV file. Please check file structure.');
      }
    };

    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const downloadSampleCsv = () => {
    const link = document.createElement('a');
    link.href = '/kolkata_full_case_dataset.csv';
    link.setAttribute('download', 'kolkata_full_case_dataset.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const categoryCounts = dataPoints.reduce((acc, pt) => {
    acc[pt.category] = (acc[pt.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFirCases = dataPoints.reduce((sum, pt) => sum + (pt.crime_breakdown?.fir_cases_count || 1), 0);

  const filteredPoints = dataPoints.filter((pt) =>
    pt.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pt.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pt.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
              Kolkata FIR Case Dataset Integration
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Backend Integrated
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Active Backend CSV: <strong className="text-emerald-300 font-mono">{currentFileName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleCsv}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-1.5 px-3 rounded-lg border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Download full FIR case CSV dataset"
          >
            📥 Download Dataset
          </button>

          {currentFileName !== 'kolkata_full_case_dataset.csv' && (
            <button
              onClick={onResetDefault}
              className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium py-1.5 px-3 rounded-lg border border-amber-500/30 transition cursor-pointer"
            >
              🔄 Reset to Full FIR Dataset
            </button>
          )}
        </div>
      </div>

      {/* Drag & Drop Box */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-950/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center justify-center space-y-1.5">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-xl shadow-inner">
            📁
          </div>
          <p className="text-sm font-semibold text-zinc-200">
            Upload custom CSV dataset file to test backend parser
          </p>
          <p className="text-xs text-zinc-400">
            Parsed case fields: <code className="text-emerald-400">FIR_Number</code>, <code className="text-emerald-400">Crime_Type</code>, <code className="text-emerald-400">Street_Lighting</code>, <code className="text-emerald-400">Time_Slot</code>, <code className="text-emerald-400">Severity</code>
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Active Dataset Stats Badge */}
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400">
            Backend Dataset File: <strong className="text-emerald-400 font-mono">{currentFileName}</strong>
          </span>
          <span className="text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-700">
            Total FIR Cases: <strong className="text-white">{totalFirCases}</strong> ({dataPointsCount} Localities)
          </span>
        </div>

        {/* Category Pill Summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg">
            🛡️ Safe Sectors: {categoryCounts['Safe Zone'] || 0}
          </span>
          <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg">
            🚨 High FIR Crime Sectors: {categoryCounts['High Crime'] || 0}
          </span>
          <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-lg">
            👮 Police Booths: {categoryCounts['Police'] || 0}
          </span>
        </div>

        {/* Expandable Data Table Button */}
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium py-2 px-3 rounded-lg border border-zinc-800 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {showTable ? '🔼 Hide Dataset Table' : '🔽 Preview Kolkata Locality & FIR Case Summaries (' + dataPointsCount + ' localities)'}
        </button>
      </div>

      {/* CSV Records Preview Table */}
      {showTable && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-300">Kolkata Locality FIR Crime Records</h4>
            <input
              type="text"
              placeholder="Search locality..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="max-h-64 overflow-y-auto border border-zinc-800/80 rounded-lg">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 sticky top-0 border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-3">Area / Locality</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">AI Safety Score</th>
                  <th className="py-2 px-3">Total FIR Cases</th>
                  <th className="py-2 px-3">Crimes Against Women</th>
                  <th className="py-2 px-3">Poor Light Cases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredPoints.map((pt, idx) => (
                  <tr key={pt.id || idx} className="hover:bg-zinc-900/50 transition">
                    <td className="py-2 px-3 font-semibold text-white">{pt.location_name}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pt.category === 'Safe Zone' ? 'bg-emerald-500/20 text-emerald-400' :
                        pt.category === 'High Crime' ? 'bg-red-500/20 text-red-400' :
                        pt.category === 'Police' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {pt.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold">
                      <span className={pt.safety_score >= 88 ? 'text-emerald-400' : pt.safety_score >= 80 ? 'text-amber-400' : 'text-red-400'}>
                        {pt.safety_score}/100
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-white">
                      📋 {pt.crime_breakdown?.fir_cases_count || 1}
                    </td>
                    <td className="py-2 px-3 font-semibold text-red-300">
                      🚨 {pt.crime_breakdown ? pt.crime_breakdown.crimes_against_women : 'N/A'}
                    </td>
                    <td className="py-2 px-3 font-medium text-amber-300">
                      💡 {pt.crime_breakdown?.poor_lighting_cases ?? 'N/A'}
                    </td>
                  </tr>
                ))}
                {filteredPoints.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-zinc-500">
                      No locality records found matching "{searchTerm}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
